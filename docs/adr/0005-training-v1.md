# 0005: Workout tracking, muscle heat model and body map, keylow-training-v1

## Status

Accepted, 2026-10-17 (Zee approved the pull request that carries it, #262).

## Context

Ki-Lo gains a second pillar next to nutrition: a workout tracker. The user logs sessions and sets, sees a body map where each muscle glows hotter the more recently and heavily it was trained and cools down as it recovers, sees whether each muscle is under- or overtrained this week, and gets a suggested next session that serves their goal (for example a V-taper, which puts side delts and lats first, or strength, which puts the main lifts first). The user can also ignore suggestions and run their own routine on the days they pick.

The shape follows the nutrition side on purpose: raw logs in Postgres, pure versioned maths in `@keylow/core`, and the screens only draw what core returns. This ADR fixes that shape, the muscle list, the heat and volume model, and the rendering path, so the milestones that build them do not renegotiate them. It implements nothing.

The tables here are new. ADR 0003 freezes the nutrition schema only; these tables follow its conventions (Amendment 1 surrogate and audit columns, owner-only RLS with `(select auth.uid())`, pgTAP for every policy, cascade from `auth.users`).

## Decision

### The muscle list is the contract

A fixed list of muscle ids, seeded by migration, global and read-only. The same ids name the regions of the 2D body map and the meshes of the 3D model, so the database, core and the renderer meet on them. The list is finer than most exercise databases where aesthetics need it (three delt heads, upper and lower chest, two glute regions):

| Group     | Ids                                                                                |
| --------- | ---------------------------------------------------------------------------------- |
| Chest     | `chest_upper`, `chest_lower`                                                       |
| Shoulders | `delt_front`, `delt_side`, `delt_rear`                                             |
| Back      | `lats`, `traps_upper`, `traps_mid` (mid and lower traps, rhomboids), `lower_back`  |
| Arms      | `biceps` (with brachialis), `triceps`, `forearms`                                  |
| Core      | `abs`, `obliques`                                                                  |
| Legs      | `glute_max`, `glute_med`, `quads`, `hamstrings`, `adductors`, `calves`, `tibialis` |
| Neck      | `neck`                                                                             |

Left and right are one muscle in v1: a unilateral set counts for the muscle once per side performed. Adding or splitting an id is a new list version, never an edit in place.

### Tables

- `muscles` (id text pk, group, size_class small|medium|large, position): global, seeded.
- `exercises` (owner_id null for global, name, equipment, mechanic compound|isolation, source, source_ref, deleted_at): like `foods`, with user-owned rows writable only by their owner.
- `exercise_muscles` (exercise_id, owner_id denormalised for RLS, muscle_id, role primary|secondary|stabiliser, weight numeric 0..1): the per-muscle share of a set. Bench press is `chest_lower 1.0, chest_upper 0.6, delt_front 0.5, triceps 0.5`. Every exercise has at least one primary muscle.
- `workout_sessions` (user_id, started_at, ended_at, local_date, tz, routine_day_id null, note, deleted_at).
- `workout_sets` (session_id, user_id, exercise_id, position, set_type warmup|working|drop|failure, reps, load_kg, rir null, rpe null, performed_at, snapshot jsonb, deleted_at). `snapshot` freezes the exercise's muscle map at log time, the same rule as food snapshots: editing an exercise's muscles never rewrites past heat.
- `routines` (user_id, name, is_active, is_archived; at most one active per user) and `routine_days` (routine_id, weekday null, position, name) and `routine_exercises` (routine_day_id, exercise_id, position, target_sets, rep_min, rep_max, target_rir).
- `training_goals` (user_id, goal aesthetic|strength|hybrid, focus text[], days_per_week, session_minutes, equipment text[], experience beginner|intermediate|advanced, muscle_priority jsonb, answered_at): one current row per user, history kept like `targets`.

The global exercise library is imported the CoFID way: a script in `packages/db/scripts`, a curated CSV in `packages/db/data/exercises/`, raw rows kept in a service-role table. The starting source is free-exercise-db (public domain), re-mapped by hand from its coarse groups onto the muscle list above and reviewed before import. wger (CC-BY-SA) is a secondary reference only and is not bulk-imported, to keep the share-alike licence out of the data.

### The heat model (pure, versioned)

Everything lives in `packages/core/src/training/**` under the ADR 0002 purity rule: no IO, no `Date.now()`, no randomness; `now` is an argument. Every tunable is in one `TrainingParams` object with `version: 'keylow-training-v1'`.

Stimulus of one set on muscle `m`:

```
s = weight_m × effort(set)
effort = 0 for a warm-up; 1 when rir ≤ 3 (or rpe ≥ 7, or rir unknown on a working set); 0.5 when rir is 4 or 5; 0.25 above 5
```

Acute fatigue and heat:

```
F_m(t)    = Σ s_j · exp(−(t − t_j) / τ_m)       over the sets of the last 14 days
heat_m    = clamp(F_m / C_m, 0, 1)
ready_at  = t + τ_m · ln(F_m / θ)  when F_m > θ, else now
```

Because fatigue decays exponentially from a dose-sized peak, more volume means a longer time to recovery with no extra rule.

Chronic load: `weeklySets_m` is the effort-weighted set count of the last 7 days, compared with volume landmarks `MEV_m ≤ MAV_m ≤ MRV_m` to give `under | maintaining | productive | over`. A fifth status, `not_targeted`, replaces `under` (and only `under`) for a muscle the plan and the goal do not train (Zee, 2026-10-18, KEY-339 ruling E, definition confirmed on KEY-356). A muscle is targeted when some exercise of the active routine's days holds it in its muscle map with a weight above 0 (on any day, a day with no weekday included), or when the goal's `muscle_priority` ranks it above 0. With neither a routine with exercises nor a priority above 0, every muscle is targeted. A muscle that is not targeted but has reached its MEV keeps its real status, so a muscle the user in fact trains is never hidden and over-training is never masked. Heat, `readyAt` and `weeklySets` do not depend on it. No `TrainingParams` value changes and a call that does not say which muscles are targeted returns what it returned before, so this is not a new params version (ADR 0002).

Starting values, by size class (to be tuned; they are a starting point, not settled physiology):

| Size class | Muscles                                                                 | τ (h) | C (sets) | MEV | MAV      | MRV |
| ---------- | ----------------------------------------------------------------------- | ----- | -------- | --- | -------- | --- |
| small      | delts, biceps, triceps, forearms, calves, tibialis, neck, abs, obliques | 24    | 8        | 6   | 10 to 16 | 22  |
| medium     | chest, lats, traps, glute_med, adductors                                | 32    | 10       | 8   | 12 to 18 | 22  |
| large      | quads, hamstrings, glute_max, lower_back                                | 40    | 10       | 6   | 10 to 16 | 20  |

`θ = 0.25 × C_m`. A per-muscle override map exists in the params for when one muscle needs to differ from its class.

Functions: `muscleState(sets, now, params, targeted?)` returns `{ heat, readyAt, weeklySets, volumeStatus }` per muscle id; `weeklyVolume(sets, asOf, params, targeted?)`; `targetedMuscles({ routine, priority? })` returns the targeted set (above), which `muscleState`, `weeklyVolume` and `projectedState` take as an optional trailing argument, every muscle being targeted when it is left out; `expandPlan` and `compareWeek` (below); `suggestSession(state, goals, library, constraints, params)`.

### Projected against actual

Two views of the same week, drawn with the same maths:

- **Actual** comes from the logged sets.
- **Projected** comes from the plan: the active routine's days placed on their weekdays for the week, each routine exercise expanded into `target_sets` planned sets at `target_rir`, with the snapshot taken from the exercise's current muscle map. A planned session the user has already logged is replaced by its actual sets; a planned day that passed without a session stays in the projection, so a missed day shows as a gap.

`expandPlan(routine, weekStart, tz, params)` returns planned sets of the same shape as logged sets (marked `planned: true`), so `muscleState` and `weeklyVolume` run on them unchanged. `compareWeek(actual, projected)` returns, per muscle, the actual weekly sets, the projected weekly sets and the gap, with status `behind | on_plan | ahead` (on plan within a params tolerance of 1 set). Heat can be shown for any day of the week in both views: actual heat uses sets up to that moment, projected heat assumes the plan was followed up to that moment. Today's unlogged planned session is not counted in projected heat: a planned set counts only from the day after its date, so today's projected heat shows what is logged today (Zee, 2026-10-18, KEY-339 ruling D). A planned set is still placed at the planned time (18:00 local in v1), which is where it decays from, so a planned Thursday set is 6 hours old at the start of Friday. Suggestions from T5 accepted into a day count as planned: their sets are planned on that date at the planned time and count from the day after, like a routine day's, and they are in the projection and never in the actual sets. What was logged replaces them. A suggestion folded into a routine day lives and dies with that day: it is replaced only when that day is logged, on any date, and a free session on its date does not replace it. A standalone suggestion (no routine day, or a day the routine no longer has) is replaced by any live session on its date, whose logged sets take its place, and on a date with no session it stays planned, so a missed one reads as a gap. `targetedMuscles` is unchanged: a muscle only an accepted suggestion trains is targeted by the goal that produced it.

As built (KEY-352, PR #269), the signatures differ from the sketch above in three ways. The plan tunables (planned time 18:00 local, on plan tolerance 1 set) are a `CompareParams` object, `COMPARE_PARAMS_V1`, that carries the `TrainingParams` it was tuned with and the same version, because adding fields to the pinned v1 training object would edit it in place. `compareWeek(actual, projected, params)` takes it. And the merge of logged sessions into the plan is its own function, `projectWeek(routine, weekStart, tz, logged, params)`, which returns `{ planned, actual, projected }`: a logged session of a routine day replaces that day's planned sets, so extra sets on a logged day count as on plan (Zee confirmed this reading on KEY-353, 2026-10-18). `projectedState(projected, at, tz, params)` gives projected heat at a moment, counting a planned set only when its date is before the local date of `at` in `tz` (KEY-355). The gap view uses `compareWeekSoFar(projection, at, tz, params)` (KEY-394), which leaves out the planned sets dated the local date of `at` or later, so before Sunday it counts only the planned days up to yesterday plus today once it is logged, and on Sunday it equals `compareWeek` except for a planned Sunday session not yet logged, which is not counted. `compareWeek` still compares the whole week's plan for the volume view (Zee, 2026-10-18, KEY-339 question G). The week is the calendar week, Monday to Sunday, in the user's zone (Zee, KEY-339 ruling B). That week is for the compare only: the chronic `weeklySets` of `muscleState` stays a rolling 7 days.

A routine plans from the local date it was made active, so a routine switched on a Thursday plans nothing for the Monday to Wednesday before it and those days never read as missed (Zee, KEY-378, 2026-10-18, `PlanRoutine.activeFrom` in `expandPlan`, KEY-383). Sessions logged earlier in the week keep their own days.

It runs on the client. The input is a few hundred sets at most, so unlike the nutrition check-in there is no Edge Function and nothing derived is persisted. A daily snapshot table can be added later if history charts need it.

### Goals and suggestions

The goal questionnaire writes `training_goals`. `muscle_priority` is derived in core from the answers through preset maps, versioned with the params: `aesthetic` with `v_taper` raises `delt_side`, `lats` and `chest_upper` and lowers direct `obliques` work; `strength` raises the muscles of the squat, bench, deadlift and overhead press and switches rep targets to lower ranges with load progression. A muscle with priority 0, or absent from `muscle_priority`, is not targeted by the goal (the routine can still target it, see "The heat model").

`suggestSession` is deterministic. It scores each muscle as `priority × max(0, MAV_low − weeklySets) × (1 − heat)`, then greedily picks exercises from the library that cover the top-scoring muscles. It skips exercises whose primary muscles are hot (heat above a params threshold) and stays inside the session's minutes and equipment. When the day has a planned routine day, it keeps the plan and only swaps or adds exercises. Every suggestion carries its reasons as data (muscle ids and the numbers behind them), so the screen and any later assistant can explain it without recomputing.

### The body map: 2D first, 3D behind the same interface

One renderer contract on both apps: `BodyMap({ values: Record<MuscleId, number>, scale: 'heat' | 'volume' | 'gap', view: 'actual' | 'projected', onToggleView, onSelect })`. The screen shows the map in three modes from the same component: **Actual**, **Projected**, and side by side (two maps, one actual, one projected, sharing rotation in 3D), plus a day-of-week scrubber for heat. Both the 2D and the 3D renderer support every mode.

Gestures, the same on both renderers and both apps:

- **Tap the model** toggles between Actual and Projected, with a short cross-fade and a label on the map naming the view now shown. In side by side both views are already showing, so a tap there does not change the view.
- **Long-press a muscle** opens its detail sheet (`onSelect`). A tap is reserved for the toggle, so selection never fights it.
- **Drag** rotates in 3D. A touch that moves past a small threshold is a drag, never a tap, so rotating never toggles the view.
- The toggle also exists as a visible control next to the map (`accessibilityRole="button"`, named for the view it switches to). Screen-reader users and keyboard users on web use it, and every muscle stays selectable from a list in the detail sheet, so no action depends on a gesture alone.

1. **2D (first):** a front and back SVG with one path per muscle id, drawn with `react-native-svg` on mobile and inline SVG on web. Ships with the heat model and proves the logging loop.
2. **3D (later):** `@react-three/fiber` with `drei` on web, and `@react-three/fiber/native` with `expo-gl` on mobile (the dev client allows the native module). The asset is a glTF binary of about 2 to 4 MB, male and female, each muscle a mesh named by its id. A Blender script in `tools/body-model` turns the source model into that file: decimate, rename, Draco or meshopt compression. Each muscle's material colour and emissive intensity follow its value on the scale. If draw calls become a problem, the fallback is one merged mesh with a per-vertex muscle id attribute and a shader that reads a uniform array of values. A long-press raycasts to the muscle's id and opens the same detail sheet as the 2D map; a tap toggles the view as above.

Two colour scales: `heat` is sequential (neutral grey at rest, then green when the muscle is ready, through yellow and amber to red at full heat, with a matching glow); `volume` is diverging (blue under, green productive, red over). `gap` is diverging around the plan (blue behind plan, neutral on plan, amber ahead of plan). The colours come from `@keylow/tokens` and are checked for contrast in light and dark.

The source model is a human decision taken before the 3D milestone starts: Z-Anatomy or BodyParts3D (free, CC-BY-SA, attribution on the About screen, heavy cleanup) or a licensed commercial model whose licence allows bundling in an app.

### Claude's role

The heat model, volume status and suggestions are code, not model output. Training coaching (explaining why a session was suggested, tips, answering "am I overtraining my shoulders") is a later extension of the M8 assistant and follows its rules: behind the consent toggle, with evals in CI, cost caps, and no data from one account reaching another. It follows the M9 rule too: the model may propose, and core computes and verifies. The assistant reads `muscleState` and the suggestion's reasons through tools. It never invents a number.

### Compatibility with the nutrition side

Training is a separate Linear project from KeyLow v1 but the same product, account and codebase, and it is meant to build on nutrition. These rules keep the two compatible:

- **One app, one account, one profile.** Training lives in the existing apps (a new tab or section), the existing auth and the existing `profiles` row. It reads `weight_unit` for load display and `timezone` for `local_date`. It does not add a second profile or a separate onboarding; the goal questionnaire is a step that can run after or alongside M6 onboarding.
- **Same packages, same rules.** `@keylow/core` (pure, no platform deps, runs in RN and Deno), `@keylow/api-client` (repos and TanStack Query hooks with the shared query-key factory), `@keylow/tokens` for every colour, `@keylow/core/copy` for strings. Loads are stored in kg, the same way weights are stored in kg and energy in kcal.
- **Training changes the day's calorie target, never the expenditure measurement.** `keylow-engine-v1` (trend, expenditure, `deriveTargets`) is untouched and still measures true expenditure from intake and weigh-ins. Training acts on its output in a separate pure layer, below, so the engine's golden numbers stay valid.
- **Where the two meet, by design.** A strength or hypertrophy goal can suggest a program goal and `protein_g_per_kg` for M6 to use (the user confirms; nutrition stays the owner of targets). The dashboard can show a training card next to the nutrition ones. The M8 assistant gets training tools beside its diary and weight tools, under the same consent, eval and cost rules.
- **Data lifecycle is shared.** Training tables cascade from `auth.users`, join the M7 data export, and are removed by the same account deletion.

### Training-aware calories

Zee decided on 2026-10-17 that training changes the calorie maths, in four ways. All four live in `packages/core/src/training/fuel/` with their own params, `version: 'keylow-fuel-v1'`, apply after `deriveTargets`, and are off until the user turns them on from the program screen (each one separately).

The rule that holds them together: the M6 engine's measured expenditure `mu` already contains the user's **average** training, so nothing may add that average a second time.

1. **Shift calories to training days (zero-sum).** The week's calories stay `7 × calories_kcal` from the current `targets` row. A training day gets `+shift`, a rest day the matching minus, so the week sums to the same total. `shift` scales with the day's planned or logged effective sets (params: `kcalPerEffectiveSet`, cap `maxShiftKcal 300`, rest-day floor still bound by the engine's `floorAbsKcal` and `floorBmrFactor`). A day starts from the plan (projected training). When the user trains on an unplanned day or skips a planned one, today and the remaining days of the week rebalance. **A past day's target never changes.** When the shift is on, it replaces the program's manual `dow_offsets_kcal` for that week; the two are never summed.
2. **Burn credit for training above your usual (eat back the difference).** Each logged session gets an estimated burn: `MET(effort) × trend_weight_kg × active_hours`, MET from the session's effort-weighted sets per minute (params: `metLow 3.5`, `metHigh 6.0`). Baseline is the average daily logged burn over the same 28-day window the engine measured `mu` over. Every day's credit is `creditFraction × (burn_day − baseline)`, where a rest day has `burn_day = 0`, so it is positive on harder days and negative on rest days, with `creditFraction 0.5` (burn estimates are rough) and `maxCreditKcal 400`. Both the shift and the credit average zero over a usual week, so with both on the week still sums to the engine's total when training is as usual; training more than usual earns calories; training less gives some back. Only logged sessions earn credit, never planned ones. The credit is added on the day it is logged and never moves a past day.
3. **Training goal sets the surplus or deficit and protein.** T5's goal presets propose an M6 program goal and rate (for example hypertrophy: lean gain of 0.25% per week; V-taper: recomposition at maintenance; strength: maintenance to slight surplus) and `protein_g_per_kg` (1.6 to 2.2). The user confirms on the program screen; the engine then runs as normal from the new program.
4. **Better first estimate.** Before the engine has enough data (`minSpanDays`, `minWeighDays`), the initial expenditure prior's activity factor comes from training instead of the self-reported activity level alone: planned or logged sessions per week and their minutes raise or lower the factor within a capped band. Once measurement takes over, the prior only matters through `priorCv`, as in ADR 0002.

The day target is what the diary shows: `dayTarget = calories_kcal + shift_day + credit_day`, then the engine floors. Each day's parts are persisted in `day_target_adjustments` (user_id, local_date, shift_kcal, credit_kcal, burn_kcal, basis jsonb, fuel_version), unique `(user_id, local_date)`, so a day's target is reproducible and a retune never rewrites history. Macros: the extra or removed calories go to carbohydrate; protein and fat stay as `targets` sets them.

What M6 must provide (KeyLow v1): one read path, `dayTarget(targets, localDate, adjustments)`, used by every screen that shows a day's calorie target, so training adjustments plug in without editing the engine. With no adjustments the function returns today's behaviour exactly. Item 4 needs the M6 initial estimate to take an optional activity factor input. Both are interface points, not engine maths, and are recorded as a note on the M6 brief (KEY-6). If M6 wants them in ADR 0002, they go in as an amendment there.

### Health data

Training logs are health data under the project's Working conventions: no exercise name, load, reps or muscle value in logs, error reports or analytics (ids and counts only). Training tables are in the data export and are removed by account deletion. Training reads are kept in the same private on-device cache as the diary (Zee, 2026-10-18) and removed on sign out, and KEY-254 encrypts the whole cache later.

## Consequences

- The training milestones implement the tables, `packages/core/src/training/**` and the `BodyMap` contract above without renegotiating them. The column lists here are a forward contract in the same sense as ADR 0003.
- A change to `TrainingParams` values or the preset priority maps is a new version, not an edit of `keylow-training-v1`.
- The muscle id list is shared by the database seed, core, the SVG and the 3D asset. Changing it means a new list version and a matching asset update.
- Training-aware calories never edit `keylow-engine-v1`; they are a separate layer with its own version, and a change to its params is a new `keylow-fuel` version.
- The 2D map ships before the 3D model, so the 3D work is a renderer swap and never blocks the tracker.
- Choosing the 3D source model and its licence is a human decision recorded before the 3D milestone starts.

## Amendment 1 (T1: exact training schema, 2026-10-18)

### Status

Recorded on 2026-10-18 under KEY-343. Both T1 migrations (KEY-347 and KEY-348) build exactly to this amendment, as the recipes migration built to ADR 0003 Amendment 8. It fills in what the accepted "Tables" section leaves open and overrides nothing in it. Everything below is an interpretation made for implementation unless it quotes the accepted text, so Zee confirms it by approving the pull request that carries it. The choices most worth a second look are:

- `exercise_muscles.weight` must be above 0, not just at least 0, because a muscle with weight 0 contributes nothing and should not be listed.
- The at-least-one-primary rule is a deferred constraint trigger, not a check inside a function, so the import (which writes as the service role) is held to it too.
- `routine_days` keep their ids across edits (`save_routine` updates them in place), so a logged session's link to its planned day survives an edit of the routine.
- A routine day has at most one per weekday.
- Sets are soft deleted, and their `position` has no uniqueness rule, so reordering never collides.
- Equipment is an enum, not a text list.

### Conventions

Every new table carries ADR 0003 Amendment 1's two columns: `id uuid primary key default gen_random_uuid()` and `created_at timestamptz not null default now()`. There is no `updated_at`. Two exceptions:

- `muscles` is keyed by its text id (`id text primary key`). It keeps `created_at`.
- `exercise_source_data` is keyed by `exercise_id`, as `food_source_data` is keyed by `food_id`. It keeps `created_at`.

Every user-owned table has `user_id` (or `owner_id` where the row may also be global) as `uuid references auth.users (id) on delete cascade`. Row level security is enabled on every table. Every policy uses `(select auth.uid())`. Each table starts from `revoke all ... from anon, authenticated, service_role` and grants back only what is listed under "Privileges and row level security". A column added later is not writable by clients until a migration grants it, the rule of ADR 0003 Amendments 3 and 4.

Weekdays are `0` (Monday) to `6` (Sunday), the numbering core's `calendarDay` already uses.

### Enums

| Enum                | Values                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `muscle_group`      | `chest`, `shoulders`, `back`, `arms`, `core`, `legs`, `neck`                                                      |
| `muscle_size_class` | `small`, `medium`, `large`                                                                                        |
| `exercise_source`   | `free_exercise_db`, `user`                                                                                        |
| `exercise_mechanic` | `compound`, `isolation`                                                                                           |
| `muscle_role`       | `primary`, `secondary`, `stabiliser`                                                                              |
| `equipment`         | `barbell`, `dumbbell`, `kettlebell`, `cable`, `machine`, `smith_machine`, `ez_bar`, `band`, `bodyweight`, `other` |
| `set_type`          | `warmup`, `working`, `drop`, `failure`                                                                            |
| `training_goal`     | `aesthetic`, `strength`, `hybrid`                                                                                 |
| `experience_level`  | `beginner`, `intermediate`, `advanced`                                                                            |

Equipment is an enum rather than a checked text list because `exercises.equipment` and `training_goals.equipment` (an array) must share one list, and an enum gives both the same generated TypeScript union. Adding a value is a migration either way.

### The numbers

| What                      | Bound                                                                           |
| ------------------------- | ------------------------------------------------------------------------------- |
| Names (exercise, routine) | not blank, at most 200 characters                                               |
| Routine day name          | not blank, at most 100 characters                                               |
| Session note              | at most 1,000 characters                                                        |
| `exercise_muscles.weight` | above 0 and at most 1                                                           |
| Muscles per exercise      | at most 22 (one row per muscle at most)                                         |
| `reps`                    | integer, 1 to 100                                                               |
| `load_kg`                 | at least 0 and at most 1,000; null for an unloaded bodyweight set               |
| `rir`                     | integer, 0 to 10                                                                |
| `rpe`                     | 1 to 10 in steps of 0.5                                                         |
| Sets per session          | at most 200                                                                     |
| Days per routine          | at most 7, at most one per weekday                                              |
| Exercises per routine day | at most 30                                                                      |
| `target_sets`             | integer, 1 to 20                                                                |
| `rep_min`, `rep_max`      | integers, 1 to 100, `rep_min <= rep_max`                                        |
| `target_rir`              | integer, 0 to 10, nullable                                                      |
| `days_per_week`           | integer, 1 to 7                                                                 |
| `session_minutes`         | integer, 15 to 180                                                              |
| `focus`                   | a subset of `v_taper`, `chest`, `arms`, `glutes`, `legs`, `overall`, no repeats |

Core exports the same numbers as constants (KEY-346), and its schemas check them before any write.

### `muscles`

| Column       | Definition                                                 |
| ------------ | ---------------------------------------------------------- |
| `id`         | `text primary key`, with check `id ~ '^[a-z_]+$'`.         |
| `group`      | `muscle_group not null`.                                   |
| `size_class` | `muscle_size_class not null`.                              |
| `position`   | `integer not null unique`, the order of the accepted list. |
| `created_at` | as the conventions.                                        |

Seeded in the same migration with exactly the 22 ids of "The muscle list is the contract", in its order. Their size classes are the table in "The heat model". Nothing writes the table after the migration: clients, the service role and the import get no write grant. Adding or splitting an id is a new list version and a migration.

### `exercises`

| Column       | Definition                                                                                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `owner_id`   | `uuid references auth.users (id) on delete cascade`, nullable, no default. Null exactly for a global row: check `(source = 'user') = (owner_id is not null)`, as `foods` has. |
| `source`     | `exercise_source not null`.                                                                                                                                                   |
| `source_ref` | `text`, nullable. Check `(source = 'user') = (source_ref is null)`: every imported row has one and no user row does.                                                          |
| `name`       | `text not null`, not blank, at most 200 characters.                                                                                                                           |
| `equipment`  | `equipment not null`.                                                                                                                                                         |
| `mechanic`   | `exercise_mechanic not null`.                                                                                                                                                 |
| `deleted_at` | `timestamptz`, nullable. Exercises are soft deleted, never hard deleted, because logged sets and routine exercises reference them.                                            |

- `unique (source, source_ref)`. Postgres treats nulls as distinct, so user rows never collide.
- `gin (name extensions.gin_trgm_ops)` for name search, and a partial `(owner_id) where owner_id is not null` for the library and the account deletion cascade.
- The library search is a case-insensitive `ilike` through PostgREST, escaped by the client, with no new function, the answer ADR 0003 Amendment 8 gives for recipes.

### `exercise_muscles`

| Column        | Definition                                                                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exercise_id` | `uuid not null references public.exercises (id) on delete cascade`.                                                                                                          |
| `owner_id`    | `uuid references auth.users (id) on delete cascade`, nullable. A denormalised copy of the exercise's `owner_id` for RLS, as `food_portions` has. Null for a global exercise. |
| `muscle_id`   | `text not null references public.muscles (id)`.                                                                                                                              |
| `role`        | `muscle_role not null`.                                                                                                                                                      |
| `weight`      | `numeric not null`, with check `weight > 0 and weight <= 1`.                                                                                                                 |

- `unique (exercise_id, muscle_id)`. That index also serves reading an exercise's map and the cascade from `exercises`. A plain index on `muscle_id` serves the reverse lookup ("exercises for side delts").
- The map is replaced as a whole on every save (rows deleted and inserted), so nothing references an `exercise_muscles` id.
- **At least one primary muscle:** a constraint trigger `exercise_has_primary_muscle`, `deferrable initially deferred`, after insert or update on `exercises` and after insert, update or delete on `exercise_muscles`. At commit it checks that every affected exercise that still exists has at least one `primary` row, and otherwise raises `23514` with the message "an exercise needs at least one primary muscle" and no value. Because it is deferred, `save_exercise` and the import can delete and reinsert a map inside one transaction. An exercise removed in the same transaction (an account deletion cascade) is skipped.

### Exercise provenance

Separate from the foods tables, so the foods schema and its `food_source` enum are untouched.

- `exercise_import_runs`: `source exercise_source not null` with check `source <> 'user'`, `label text not null`, `source_commit text not null`, `file_sha256 text not null` (64 hex characters), `started_at timestamptz not null default now()`, `finished_at timestamptz`, `row_count integer`, and the conventions' columns.
- `exercise_source_data`: `exercise_id uuid primary key references public.exercises (id) on delete cascade`, `import_run_id uuid not null references public.exercise_import_runs (id)`, `raw jsonb not null` (the source row as fetched), `created_at`.

Neither is visible to `anon` or `authenticated`.

### `workout_sessions`

| Column           | Definition                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_id`        | `uuid not null default auth.uid() references auth.users (id) on delete cascade`.                                                                                 |
| `started_at`     | `timestamptz not null`.                                                                                                                                          |
| `ended_at`       | `timestamptz`, nullable while the session is in progress. Check `ended_at >= started_at`.                                                                        |
| `local_date`     | `date not null`, the user's calendar day of `started_at`, as `food_log_entries.local_date` is.                                                                   |
| `tz`             | `text not null`, the IANA zone the day was computed in, not blank, at most 64 characters.                                                                        |
| `routine_day_id` | `uuid references public.routine_days (id) on delete set null`, nullable. Set when the session was started from a planned day. A plain index serves the set-null. |
| `note`           | `text`, nullable, at most 1,000 characters.                                                                                                                      |
| `deleted_at`     | `timestamptz`, nullable. Sessions are soft deleted, so a mistaken delete can be undone like a diary entry.                                                       |

Index `(user_id, local_date)` for history and the week view.

### `workout_sets`

| Column         | Definition                                                                                                                                                                                                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session_id`   | `uuid not null references public.workout_sessions (id) on delete cascade`.                                                                                                                                                                                                                                             |
| `user_id`      | `uuid not null default auth.uid() references auth.users (id) on delete cascade`. A denormalised copy of the session's for RLS and for the heat window index.                                                                                                                                                           |
| `exercise_id`  | `uuid not null references public.exercises (id)`, with the default `no action`. Exercises are soft deleted, so this never blocks a normal edit. An account deletion removes the user's sets and custom exercises in the same statement, which `no action` allows; KEY-348 proves it, as KEY-283 proved it for recipes. |
| `position`     | `integer not null`, at least 0, with no uniqueness rule. Sets are read in `position`, then `performed_at`, then `id` order, so a tie is harmless and a reorder is a plain update of two rows with nothing to collide.                                                                                                  |
| `set_type`     | `set_type not null default 'working'`.                                                                                                                                                                                                                                                                                 |
| `reps`         | `integer not null`, 1 to 100.                                                                                                                                                                                                                                                                                          |
| `load_kg`      | `numeric`, nullable, at least 0 and at most 1,000. Stored in kg whatever the profile's unit.                                                                                                                                                                                                                           |
| `rir`          | `smallint`, nullable, 0 to 10.                                                                                                                                                                                                                                                                                         |
| `rpe`          | `numeric`, nullable, 1 to 10, with check `rpe * 2 = floor(rpe * 2)` (steps of 0.5).                                                                                                                                                                                                                                    |
| `performed_at` | `timestamptz not null default now()`.                                                                                                                                                                                                                                                                                  |
| `snapshot`     | `jsonb not null`, with a check that it is an object and that `snapshot ->> 'version'` is not null. The shape is in "The set snapshot".                                                                                                                                                                                 |
| `deleted_at`   | `timestamptz`, nullable.                                                                                                                                                                                                                                                                                               |

- Check `not (rir is not null and rpe is not null)`: at most one effort measure per set.
- Index `(user_id, performed_at)` for the 14-day heat window (T3), and a plain index on `exercise_id` for the foreign key.
- A plain index `(session_id, position)` serves reading a session in order.
- A session holds at most 200 live sets. The clients enforce it through core; the database does not count.

### The set snapshot

Each set freezes the exercise as it was when the set was logged, so editing an exercise's muscles never rewrites past heat. Core owns the shape (`buildSetSnapshot`, KEY-346) under its own constant `SET_SNAPSHOT_VERSION = 1`. It is separate from the food `SNAPSHOT_VERSION`, which does not move.

```json
{
  "version": 1,
  "kind": "exercise",
  "ref": "6f1c2b9e-0000-4000-8000-000000000001",
  "name": "Dumbbell lateral raise",
  "equipment": "dumbbell",
  "mechanic": "isolation",
  "muscleListVersion": 1,
  "muscles": [
    { "muscle_id": "delt_side", "role": "primary", "weight": 1 },
    { "muscle_id": "traps_upper", "role": "secondary", "weight": 0.3 }
  ]
}
```

`ref` is the exercise's id. `muscleListVersion` is the version of the accepted muscle list the map was written against (1 for the 22 ids), so a later list can be told apart. T3 reads only the snapshot, never the live map.

### Routines

`routines`:

| Column        | Definition                                                                       |
| ------------- | -------------------------------------------------------------------------------- |
| `user_id`     | `uuid not null default auth.uid() references auth.users (id) on delete cascade`. |
| `name`        | `text not null`, not blank, at most 200 characters.                              |
| `is_active`   | `boolean not null default false`.                                                |
| `is_archived` | `boolean not null default false`.                                                |

- Check `not (is_active and is_archived)`.
- A partial `unique (user_id) where is_active`: at most one active routine per user. Switching the active routine goes through `set_active_routine`, which clears the old one and sets the new one in one transaction.
- Routines are archived, never deleted, as recipes are.

`routine_days`:

| Column       | Definition                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `routine_id` | `uuid not null references public.routines (id) on delete cascade`.                                                                          |
| `user_id`    | `uuid not null default auth.uid() references auth.users (id) on delete cascade`. Denormalised for RLS.                                      |
| `position`   | `integer not null`, at least 0. `unique (routine_id, position)`, deferrable initially deferred so a reorder can swap positions in one save. |
| `weekday`    | `smallint`, nullable, 0 (Monday) to 6 (Sunday). Null means "any day". A partial `unique (routine_id, weekday) where weekday is not null`.   |
| `name`       | `text not null`, not blank, at most 100 characters.                                                                                         |

The weekday index is partial, so it cannot be deferred. `save_routine` therefore clears the weekday of every day it is about to move before it sets the new ones, so two days can swap weekdays in one save.

Days keep their ids across edits. `save_routine` updates a day that is sent with its id, inserts one sent without, and deletes one that is no longer sent. A deleted day sets `workout_sessions.routine_day_id` to null, so only a day the user removed loses its link. That is the link projected training (T3) uses to replace a planned day with its logged session.

`routine_exercises`:

| Column           | Definition                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| `routine_day_id` | `uuid not null references public.routine_days (id) on delete cascade`.                                               |
| `user_id`        | `uuid not null default auth.uid() references auth.users (id) on delete cascade`. Denormalised for RLS.               |
| `position`       | `integer not null`, at least 0. `unique (routine_day_id, position)`.                                                 |
| `exercise_id`    | `uuid not null references public.exercises (id)`, `no action`, for the same reason as sets. A plain index serves it. |
| `target_sets`    | `smallint not null`, 1 to 20.                                                                                        |
| `rep_min`        | `smallint not null`, 1 to 100.                                                                                       |
| `rep_max`        | `smallint not null`, 1 to 100, check `rep_min <= rep_max`.                                                           |
| `target_rir`     | `smallint`, nullable, 0 to 10.                                                                                       |

A day's exercises are replaced as a whole on every save, because nothing references them.

### `training_goals`

| Column            | Definition                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `user_id`         | `uuid not null default auth.uid() references auth.users (id) on delete cascade`.                                 |
| `goal`            | `training_goal not null`.                                                                                        |
| `focus`           | `text[] not null default '{}'`, checked by an immutable helper against the focus list in "The numbers".          |
| `days_per_week`   | `smallint not null`, 1 to 7.                                                                                     |
| `session_minutes` | `smallint not null`, 15 to 180.                                                                                  |
| `equipment`       | `equipment[] not null default '{}'`.                                                                             |
| `experience`      | `experience_level not null`.                                                                                     |
| `muscle_priority` | `jsonb not null`, an object from muscle id to a priority number, derived in core from the answers.               |
| `params_version`  | `text not null`, the `TrainingParams` version the priorities were derived with, so a retune never rewrites them. |
| `effective_from`  | `timestamptz not null default now()`.                                                                            |
| `effective_to`    | `timestamptz`, nullable. Null means current. Check `effective_to > effective_from`.                              |

A partial `unique (user_id) where effective_to is null`: one current row per user, with history kept the way `targets` keeps it. A new answer closes the current row and inserts the next through `save_training_goals`.

### Functions

All are `security invoker`, so every policy applies to their writes. All but `import_exercises` (below) refuse a payload that is not an object or array where one is expected, or that breaks a bound, with error code `22023`, and a row that is not the caller's or does not exist with `P0002`. Messages state the rule and never quote a value. For those, `execute` is revoked from `public`, `anon` and `service_role` by name and granted to `authenticated` only, as `save_recipe`'s is.

- `save_exercise(p_exercise_id uuid, p_exercise jsonb, p_muscles jsonb) returns uuid`: creates (id null) or edits a user exercise and replaces its muscle map, all or nothing. The database chooses a new exercise's id. It cannot write a global exercise.
- `save_routine(p_routine_id uuid, p_routine jsonb, p_days jsonb) returns uuid`: creates or edits a routine, updates, inserts and deletes its days as in "Routines", and replaces each day's exercises, all or nothing.
- `set_active_routine(p_routine_id uuid) returns void`: clears the caller's active routine and sets this one. Null clears without setting.
- `save_training_goals(p_goals jsonb) returns uuid`: closes the current row and inserts the new one in one transaction.
- `import_exercises(p_import_run_id uuid, p_exercises jsonb) returns jsonb` (KEY-349, `20261018150000_import_exercises.sql`): the one write path of the exercise import and of the generated `*_exercise_library.sql` migration that loads the library on every database, production included. It creates, updates and revives the global exercises of a batch, keyed by `(free_exercise_db, source_ref)`, replaces a map only when a muscle, role or weight differs, points each exercise's source row at the given run, and returns `{created, updated, unchanged}`, all or nothing, so that an exercise and its map meet the deferred primary-muscle trigger in one transaction. It is the exception to the paragraph above. It is `security invoker` with an empty `search_path` like the rest, but `execute` is revoked from `public`, `anon` and `authenticated` and granted to `service_role` only, and it checks no typed field itself, because the import's checker has already passed the CSV. A malformed payload therefore surfaces as a table error that can quote the value, so its caller keeps only the error code.

Logging a set needs no function: one set is one row, inserted and updated directly under the policies below.

### Privileges and row level security

`anon` gets nothing on any table. `authenticated`:

| Table                                          | Grants                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `muscles`                                      | `select`.                                                                                                                                                                                                                                                                                  |
| `exercises`                                    | `select`; `insert (owner_id, source, name, equipment, mechanic)`; `update (name, equipment, mechanic, deleted_at)`. No `delete`.                                                                                                                                                           |
| `exercise_muscles`                             | `select`; `insert (exercise_id, owner_id, muscle_id, role, weight)`; `delete`. No `update`: the map is replaced as a whole.                                                                                                                                                                |
| `exercise_import_runs`, `exercise_source_data` | nothing.                                                                                                                                                                                                                                                                                   |
| `workout_sessions`                             | `select`; `insert (user_id, started_at, ended_at, local_date, tz, routine_day_id, note)`; `update (ended_at, note, deleted_at)`. No `delete`.                                                                                                                                              |
| `workout_sets`                                 | `select`; `insert (session_id, user_id, exercise_id, position, set_type, reps, load_kg, rir, rpe, performed_at, snapshot)`; `update (position, set_type, reps, load_kg, rir, rpe, deleted_at)`. No `delete`. A set never changes session or exercise, and its snapshot is never rewritten. |
| `routines`                                     | `select`; `insert (user_id, name)`; `update (name, is_active, is_archived)`. No `delete`.                                                                                                                                                                                                  |
| `routine_days`                                 | `select`; `insert (routine_id, user_id, position, weekday, name)`; `update (position, weekday, name)`; `delete`.                                                                                                                                                                           |
| `routine_exercises`                            | `select`; `insert (routine_day_id, user_id, position, exercise_id, target_sets, rep_min, rep_max, target_rir)`; `delete`. No `update`.                                                                                                                                                     |
| `training_goals`                               | `select`; `insert (user_id, goal, focus, days_per_week, session_minutes, equipment, experience, muscle_priority, params_version)`; `update (effective_to)`. No `delete`.                                                                                                                   |

`service_role` gets `select`, `insert` and `update` on `exercises`, `exercise_import_runs` and `exercise_source_data`, and `select`, `insert` and `delete` on `exercise_muscles`, which the import (KEY-349) needs. It gets nothing on the user tables, because nothing server side reads them yet. The M7 export grants what it needs then.

Policies, as predicates, all for `authenticated`:

- `muscles_select_all`: using `true`.
- `exercises_select_visible`: using `owner_id is null or owner_id = (select auth.uid())`.
- `exercises_insert_own`: with check `owner_id = (select auth.uid()) and source = 'user'`.
- `exercises_update_own`: using and with check `owner_id = (select auth.uid())`. A global row cannot be updated by a client.
- `exercise_muscles_select_visible`: using `owner_id is null or owner_id = (select auth.uid())`.
- `exercise_muscles_insert_own`: with check `owner_id = (select auth.uid())` and the exercise is the caller's (`exists (select 1 from public.exercises e where e.id = exercise_muscles.exercise_id and e.owner_id = (select auth.uid()))`).
- `exercise_muscles_delete_own`: using `owner_id = (select auth.uid())`.
- `workout_sessions_*_own` (select, insert, update): `user_id = (select auth.uid())`. The insert also requires, when `routine_day_id` is set, that the day is the caller's (`exists` over `routine_days` under its own policy).
- `workout_sets_select_own`, `workout_sets_update_own`: `user_id = (select auth.uid())`.
- `workout_sets_insert_own`: with check `user_id = (select auth.uid())`, and the session is the caller's (`exists (select 1 from public.workout_sessions s where s.id = workout_sets.session_id and s.user_id = (select auth.uid()))`), and the exercise is visible to the caller (`exists (select 1 from public.exercises e where e.id = workout_sets.exercise_id)`, which runs under the exercises policy). An id that does not exist fails the same way as one that is not the caller's. Without the second `exists`, a foreign key, which ignores row level security, would let a user log a set against another user's private exercise.
- `routines_*_own` (select, insert, update): `user_id = (select auth.uid())`.
- `routine_days_*_own` (select, update, delete): `user_id = (select auth.uid())`. The insert also requires that the routine is the caller's.
- `routine_exercises_*_own` (select, delete): `user_id = (select auth.uid())`. The insert also requires that the day is the caller's and the exercise is visible, as for sets.
- `training_goals_*_own` (select, insert, update): `user_id = (select auth.uid())`.

pgTAP asserts every policy and the exact privilege set per table (KEY-347 and KEY-348).

### Health data

Training logs are health data under the project's Working conventions. No exercise name, load, rep count, effort value, goal answer or muscle value appears in a log, an error report or an analytics event; only ids and counts do. The functions and the trigger raise no `notice` or `warning` that quotes a value, and their errors state the rule only. PostgreSQL can still put a failing row in the detail of a check constraint error, which no client controls. That is why the functions check every typed field before writing, and why no client reads, logs or reports the message or detail of a database error from a training read or write.

### Export and account deletion

There is still no data export and no in-app account deletion (M7, KEY-7). The contract M7 will use:

- **Export:** every column of the user's rows in `exercises` (their own, `source = 'user'`), `exercise_muscles` (their own), `workout_sessions`, `workout_sets` (including `snapshot`), `routines`, `routine_days`, `routine_exercises`, `training_goals` (every row, current and past) and `accepted_suggestions` (every row, live and soft deleted, Amendment 4). Global exercises are not exported; the user's sets carry the snapshot of each exercise they used.
- **Deletion:** the `on delete cascade` foreign keys from `auth.users` on every user table. It needs no code, and KEY-348 proves it with a user who has sessions, sets, routines, goals and custom exercises.
- **Privacy Policy:** `packages/core/src/copy/legal.ts` lists workouts, routines and training goals as data Ki-Lo holds and as health data, and the Terms cover training (KEY-379, with `TERMS_VERSION` bumped so every user accepts once, Zee 2026-10-18). This landed before any client can store a session.

### Implemented by

- KEY-347, migration 1: the enums for exercises, `muscles` and its seed, `exercises`, `exercise_muscles` and the primary-muscle trigger, the provenance tables, `save_exercise`, their grants and policies, pgTAP, and the regenerated `packages/db/src/types.gen.ts`.
- KEY-348, migration 2: the remaining enums, sessions, sets, routines, days, routine exercises, goals, `save_routine`, `set_active_routine`, `save_training_goals`, their grants and policies, pgTAP including the account deletion proof, and `types.gen.ts`.
- KEY-346, core: `MUSCLE_IDS`, the numbers above as constants, the zod schemas and the set snapshot.
- KEY-349, the import: writes through `import_exercises`, which the `service_role` grants above allow.

## Amendment 2 (T2: routine activation date and atomic session delete, 2026-10-18)

### Status

Recorded on 2026-10-18 under KEY-378, the third training migration (`20261018160000_routine_activation_and_session_delete.sql`). It adds one column, two triggers and one function, and changes no grant, policy or row that exists. It adds to Amendment 1's "Routines", "Functions" and "Privileges and row level security" and overrides nothing in them. Zee decided on 2026-10-18 that a newly active routine plans from the day it is activated, which is why the activation date is stored.

### `routines.activated_at`

`activated_at timestamptz`, nullable, no default. It holds the moment the routine last became the active one, and is null until the first activation.

- **Why.** A newly active routine plans from the day it is activated. Without a date, switching routine on a Thursday would make the new routine's Monday to Wednesday count as missed days in the week's gap. The brief's "makes it the plan for the current week" still holds from the activation day on. Nothing recorded the day before this amendment.
- **A trigger is the only writer.** `routines_stamp_activated_at` is a `before update` row trigger with the condition `new.is_active and not old.is_active`. It sets `new.activated_at = now()`, whatever value the statement sent for the column. Every other update leaves the column alone: deactivating a routine keeps the old date, an update of the name alone never touches it, and the next activation overwrites it. The trigger fires on the false to true change however it was made, so `set_active_routine` and a direct client update of `is_active` give the same result, and `set_active_routine` needs no change.
- **No client grant.** The `update` grant on `routines` stays `(name, is_active, is_archived)` and the `insert` grant stays `(user_id, name)`. A client reads the column through the table-wide `select` and can never write it, the rule of ADR 0003 Amendments 3 and 4.
- **The trigger function** is `security invoker` with an empty `search_path`, like the other functions. Only the trigger runs it, so `execute` is revoked from `public`, `anon`, `authenticated` and `service_role` by name.
- **Routines that were active before this migration** have a null date. T1 shipped no client and no seed that activates a routine, so none is expected. Whatever reads the date treats null as "no activation date recorded".

### `delete_workout_session`

`delete_workout_session(p_session_id uuid) returns void`, added to "Functions". It is `security invoker` with an empty `search_path`, so the owner-only policies and the column grants of Amendment 1 apply to both of its writes.

- **Why.** Sessions and sets are soft deleted, and a set carries no flag of its session. Heat reads `workout_sets` alone, so a client that soft deleted the session on its own, or whose second call failed, would leave sets that heat keeps counting. The `session · discard` canvas ("removed from your history and your body map") and the history session menu both need one all-or-nothing delete.
- **What it does.** In one transaction it locks the caller's live session, soft deletes it with `deleted_at = now()`, and stamps `deleted_at = now()` on every live set of that session. A set deleted earlier keeps its earlier stamp. A session with no sets is deleted too. The row lock makes the call wait for a set that another transaction is already logging against the session, so that set is stamped with the rest. A set written after the lock was taken waits for the call and is then refused by the trigger below. The order of the two writes does not matter to that rule, because the trigger ignores a write that sets `deleted_at`. The sets are written first so that the session, which history reads, is the last row to change.
- **Refusals.** A null id raises `22023`. A session that does not exist, is not the caller's or is already deleted raises `P0002`, and the three cases give the same message. Messages state the rule and quote no value.
- **Privileges.** `execute` is revoked from `public`, `anon` and `service_role` by name and granted to `authenticated` only, as for the other functions.

### A set is written only into a live session

The trigger `workout_sets_require_live_session` (`before insert or update of deleted_at`, for each row, when the new row's `deleted_at` is null) takes a `for key share` lock on the set's session row and refuses the write with `42501` and the message "a set can only be written into a live session" when that session is visible to the caller and deleted. So a set cannot be inserted into a deleted session, and a set cannot be revived behind one. Stamping a set as deleted is never held up. Restoring a session takes two steps in this order: the session, then its sets.

- **Why a trigger and not a policy.** A policy subquery reads the snapshot its statement started with. An insert that began while a delete was in flight would pass it, then wait on the foreign key's lock and complete after the delete committed, leaving a live set in a deleted session. The same holds for a revive. The locking read waits for the delete and then sees the row as it left it.
- **The other refusals are unchanged.** A session that does not exist or is not the caller's is invisible to the trigger, which leaves it to the insert policy and the foreign key of Amendment 1, so the `workout_sets` policies are exactly as Amendment 1 has them.
- **Privileges.** The trigger function is `security invoker` with an empty `search_path`, and `execute` is revoked from `public`, `anon`, `authenticated` and `service_role` by name, as for the other trigger function.

### Health data

None of this raises a notice or an error that quotes a value. The date is a moment, not a training value, and the function's errors state the rule only.

### Implemented by

- KEY-378, migration 3: `routines.activated_at`, its trigger, `delete_workout_session`, the live session trigger on `workout_sets`, their pgTAP (`routines_activated_at.test.sql`, `delete_workout_session.test.sql` and `workout_sets_live_session.test.sql`) and the regenerated `packages/db/src/types.gen.ts`.

## Amendment 3 (T2: one session in progress per user, 2026-10-18)

Zee ruled on 2026-10-18 (KEY-386, `20261018170000_workout_sessions_one_open_per_user.sql`) that a user has at most one session in progress: the partial unique index `workout_sessions_one_open_per_user` on `(user_id) where ended_at is null and deleted_at is null` refuses a second with `23505`, the client reads back the session in progress, and the migration first ends older duplicates at their own `started_at`.

### Implemented by

- KEY-386, migration 4: `workout_sessions_one_open_per_user`, the backfill that ends older duplicates at their last live set or their start, its pgTAP (`workout_sessions_one_open.test.sql`) and the session writes of `@keylow/api-client`.

## Amendment 4 (T5: accepted suggestions, 2026-10-18)

### Status

Recorded on 2026-10-18 under KEY-397, the fifth training migration (`20261018180000_accepted_suggestions.sql`). It adds one table with its indexes, grants and policies, and changes no table, grant, policy, function or row that exists. It adds to Amendment 1's "Tables", "Privileges and row level security" and "Export and account deletion" and overrides nothing in them. Zee decided on 2026-10-18 that an accepted suggestion is a table of its own and not an edit of the routine (KEY-397), and that an accepted suggestion counts as planned (KEY-339), the canvas showing "Add to Thursday" with an Undo. "Projected against actual" already says that suggestions accepted into a day count as planned, and `projectWeek` in core has taken them as the typed input `acceptedSuggestions` since T3, but no table stored one.

### Why a table of its own

Writing the added sets into `routine_exercises` would change the user's routine for every week, and an accepted suggestion is for one day and can be undone. A row here says "on this date, this was added", leaves the routine as it is, and is gone from the projection when it is soft deleted.

### `accepted_suggestions`

| Column           | Definition                                                                                                                                                                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_id`        | `uuid not null default auth.uid() references auth.users (id) on delete cascade`.                                                                                                                                                                                                          |
| `local_date`     | `date not null`, the day the suggestion was accepted into, in the user's zone, as `food_log_entries.local_date` is.                                                                                                                                                                       |
| `routine_day_id` | `uuid references public.routine_days (id) on delete set null`, nullable. The routine day it was folded into, null when it stands alone. Removing the day from the routine clears the link and keeps the row. A plain index serves the set null.                                           |
| `exercises`      | `jsonb not null`, an array of 1 to 30 objects: the planned exercises with their target sets, rep range, target RIR and a set snapshot each. Core owns the shape (`acceptedSuggestionSchema`, KEY-402), so the table checks only the array, its length and that each element is an object. |
| `reasons`        | `jsonb not null`, an object: the reasons as data (muscle ids and the numbers behind them), so a suggestion the user took keeps its reasons when the goal changes. The table checks only that it is an object.                                                                             |
| `params_version` | `text not null`, the training params version the suggestion was made with, as `training_goals.params_version` is.                                                                                                                                                                         |
| `deleted_at`     | `timestamptz`, nullable. Undo and an accept over an earlier suggestion soft delete the row, so a mistake can be undone like a diary entry.                                                                                                                                                |

It has the conventions' `id` and `created_at` and no `updated_at`.

Checks, each breaking on one rule only so that the constraint name in a refusal states it: `accepted_suggestions_exercises_is_array`, `accepted_suggestions_exercises_count_check` (1 to 30 elements), `accepted_suggestions_exercises_are_objects` and `accepted_suggestions_reasons_is_object`. The two that read the array pass a value that is not an array, which the first refuses. The element check uses a strict path, because the default lax mode unwraps an array inside the array and would let `[[{}]]` through.

Indexes:

- `accepted_suggestions_one_live_per_user_day`: unique on `(user_id, local_date) where deleted_at is null`. A user has at most one live accepted suggestion for a day. Accepting again for the same day, or after an Undo, replaces by soft deleting the old row first in the client, and the index refuses a second live row however it is written, with `23505`. It also refuses restoring a deleted row while another is live for the day.
- `accepted_suggestions_user_id_local_date_idx` on `(user_id, local_date)`. The partial index above holds live rows only, so it cannot serve a read of a day's undone rows or the cascade from `auth.users`, which looks up `user_id` over every row. `training_goals` has its second index for the same reason.
- `accepted_suggestions_routine_day_id_idx` on `(routine_day_id)`, for the set null.

### Privileges and row level security

`anon` and `service_role` get nothing, because nothing server side reads the table yet and the M7 export grants what it needs then. `authenticated` gets `select`; `insert (user_id, local_date, routine_day_id, exercises, reasons, params_version)`; and `update (deleted_at)`. No `delete`. A suggestion never moves to another day, user or planned day, and its exercises, reasons and params version are never rewritten: it is undone and restored, or replaced by a new row.

Policies, all for `authenticated`:

- `accepted_suggestions_select_own`: using `user_id = (select auth.uid())`.
- `accepted_suggestions_insert_own`: with check `user_id = (select auth.uid())`, and, when `routine_day_id` is set, that the day is the caller's (`exists (select 1 from public.routine_days d where d.id = accepted_suggestions.routine_day_id)`, which runs under the owner-only `routine_days` policy), as `workout_sessions_insert_own` does. A day that does not exist fails the same way as one that is not the caller's.
- `accepted_suggestions_update_own`: using and with check `user_id = (select auth.uid())`.

pgTAP (`accepted_suggestions.test.sql`) asserts the exact columns, types and checks, every bound just outside and at the edge, the exact privilege set per role, the policies, the owner-only rule in both directions, the partial unique index, the set null and the account deletion.

### Health data

An accepted suggestion shows how a person trains, so it is health data under Amendment 1's "Health data". No suggestion content, exercise name or muscle value appears in a log, an error report or an analytics event, only ids and counts. The checks name the rule and never quote a value, and no client reads, logs or reports the message or detail of a database error from a training write.

### Export and account deletion

`accepted_suggestions` is in the M7 export: every column of the user's rows, live and soft deleted. It cascades from `auth.users` with the other user tables, so account deletion needs no code, and the pgTAP file proves it with a user who has a live and a soft deleted row and a routine day.

### Implemented by

- KEY-397, migration 5: `accepted_suggestions`, its checks, indexes, grants and policies, its pgTAP (`accepted_suggestions.test.sql`) and the regenerated `packages/db/src/types.gen.ts`.
- KEY-402, core: `acceptedSuggestionSchema`, the shape of `exercises` (a planned exercise with its set snapshot) and of `reasons` (`{ picks: [{ exercise_id, reasons }] }`, one entry per added exercise holding the numbers behind its pick), and `projectWeek` reading `acceptedSuggestions`.
- KEY-406, the accepted-suggestions api-client.

## Amendment 5 (T6: the 3D body, 2026-10-23)

### Status

Recorded on 2026-10-23 under KEY-586, part of KEY-342. It adds to "The body map: 2D first, 3D behind the same interface" and overrides only the lines named below. Nothing else in this ADR changes, and no other ADR changes. Zee's rulings of 2026-10-23 on KEY-342 settle the source model, the head, the licence, and 2D as the default with 3D opt-in. He settled what the female figure sees in 3D on KEY-590. Some of what follows comes from the tickets and not from a Zee comment, and is an interpretation: the mesh contract and the budget in point 2 (written from the spike, `tools/body-model/README.md`, section "Z-Anatomy male (the muscle spike)"), the quantisation in point 3, "per device" in point 5 (which follows KEY-587), the fallback that shows no error, and the small cards staying 2D. Zee confirms them by approving the pull request that carries this amendment, as Amendment 1 does.

It overrides four things. "This amendment's point" means a numbered section below, not the numbered list in "The body map".

- "The asset is a glTF binary of about 2 to 4 MB, male and female, each muscle a mesh named by its id" (this amendment's points 2 and 4).
- "Draco or meshopt compression" (its point 3).
- "The source model is a human decision taken before the 3D milestone starts" (its point 1), together with the last bullet of "Consequences", "Choosing the 3D source model and its licence is a human decision recorded before the 3D milestone starts", which this amendment discharges.
- The sequencing "2D (first)" and "3D (later)" in the list of "The body map", and the "Consequences" bullet "so the 3D work is a renderer swap and never blocks the tracker" (its point 5). The ADR never says 3D replaces 2D, but it does treat 3D as the later renderer that takes the 2D map's place. The 2D map stays, and a setting chooses which renderer the body map uses.

The earlier choice of the Blender Studio Human Base Meshes as the source for hand-cut bodies (KEY-342, 2026-10-23) is superseded by point 1. That CC0 base survives only as the head.

### 1. Source and licence

- **Male muscles:** Z-Anatomy, licensed CC BY-SA 4.0 and built on BodyParts3D, licensed CC BY-SA 2.1 JP. Only its muscle collection and its skeleton are read, because some organs in the file carry non-commercial licences. The skeleton is used to build the skin and is never exported.
- **Head:** "head A", the CC0 Blender Studio realistic male head, grafted at the neck and drawn in neutral clay. It is drawn with the Z-Anatomy face muscles hidden, so no skull shows through.
- **Licence of the asset:** CC0 material mixed into a CC BY-SA 4.0 work gives a combined asset that is CC BY-SA 4.0. It carries both attribution lines word for word:
  - BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan
  - Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0
- **Where they appear:** the app credits both lines on the About screen, and a licence notice sits beside the committed `.glb`.
- **Rejected and never used:** painting regions onto a smooth CC0 body (it read as coloured patches on a mannequin), a blank smooth head, and a MakeHuman head.

### 2. The mesh contract

The exported body holds these meshes and no others:

| Mesh                 | What it is                                                                      |
| -------------------- | ------------------------------------------------------------------------------- |
| One per `MUSCLE_IDS` | The 22 muscle ids of "The muscle list is the contract", both sides in one mesh. |
| `other`              | The visible muscles that have no id, drawn in one neutral colour.               |
| `skin`               | A see-through shell over the muscles.                                           |
| `core`               | A dark fill under the muscles, so the gaps between them read as flesh.          |
| `head`               | The grafted head, in clay.                                                      |
| `eyes`               | The eyes of the head.                                                           |

Deep muscles, head muscles and the skeleton are used to build the skin and are never exported. A muscle id still names one mesh, and the check in the export fails when an id is missing or appears twice. The meshes with no id are fixed names, so they never collide with a muscle id.

Budget per body: at most 250,000 triangles and 4 MB. This replaces "about 2 to 4 MB" with a ceiling.

### 3. Compression is quantisation

Positions and normals are quantised with the glTF extension `KHR_mesh_quantization`, which three's loader reads with no decoder. There is no Draco and no meshopt, because both decoders need WebAssembly and Hermes, the JavaScript engine of the mobile app, has none. This replaces "Draco or meshopt compression" in "The body map".

### 4. Male only in T6

T6 ships the male body only. The female body is deferred and Zee chooses its source later, so "male and female" in "The body map" is not met by T6. Until the female body exists, a person with the female figure who picks 3D sees the 2D map, with a note in the More row that reads "3D shows the male body for now". Zee chose this on KEY-590, so it is decided and nothing waits on this pull request for it.

### 5. 2D and 3D both stay

- The 2D map is the default. 3D is a per-device setting in More, with two choices, 2D or 3D.
- Both renderers take the same props, the `BodyMap` contract above. Callers, values, scales, views and gestures do not change, and a screen never knows which renderer it has.
- When 3D is chosen but cannot run (the GL module is missing, there is no GL context, or the asset fails to load), the 2D map shows and no error is shown.
- The small cards (the dashboard and Train home) stay 2D whatever the setting says.
- Two more rulings of Zee's on KEY-590. Zoom is limited to 2x and has a reset control. When 3D is chosen, the 2D figure shows first and cross-fades to 3D once it has loaded.

### Implemented by

- KEY-586, this amendment.
- KEY-553, the spike landing in `tools/body-model`, and KEY-556, the export of the asset to this contract, with KEY-555, the CI check of the contract and the budget.
- KEY-587, the 2D or 3D preference, and KEY-592, its More row.
- KEY-588, the About credit.
- KEY-561, `BodyView` and the fallback to 2D.

## Amendment 6 (the five volume bands, keylow-training-v2, 2026-10-27)

### Status

Recorded on 2026-10-27 under KEY-727, part of KEY-726. It implements Zee's ruling of 2026-10-27, quoted below. It overrides the lines named in "What it overrides" and nothing else. The heat model, the effort weights, the windows, the goal presets and every other amendment stay as they are.

Zee's ruling, after asking why his hard training week read as Under almost everywhere:

> "Cool I like this. Go ahead"

He was answering the proposal of KEY-726: the Volume view's bands move from the RP-style landmarks (MEV, MAV, MRV) to the current hypertrophy evidence. The boards (`tokens · body-map-scales` v4, `body · volume`, `body · muscle-sheet` and `body · muscle-sheet-not-targeted`) were approved under Zee's away rule on 2026-10-27, so the colours and words below are the boards' and not Zee's own comments. The three interpretations made for implementation are listed last, and Zee confirms them by approving the pull request that carries this amendment.

### The bands

`TRAINING_PARAMS_V2` carries `version: 'keylow-training-v2'`. Its heat numbers (τ, C and θ for each size class), its effort weights and its two windows are copied from v1, and a test pins each. Its volume numbers are the same for every muscle, because the evidence does not split by size class. They are effort-weighted (fractional) sets in the calendar week, Monday to Sunday, as before:

| Band        | Sets this week            | Meaning                                                                                                                                       |
| ----------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Not trained | 0                         | Nothing this week. Grey.                                                                                                                      |
| Maintaining | above 0 and below 4       | Keeps muscle already built. It assumes the user has built the muscle before.                                                                  |
| Growing     | 4 and above, below 10     | Growth, with the biggest return per set.                                                                                                      |
| Productive  | 10 up to and including 20 | More growth, and most of the benefit.                                                                                                         |
| High        | above 20                  | Small extra gains for a lot more work. It is not labelled "too much", because recovery is what heat shows. Drawn in a further green, not red. |

The edges are exact: 3.99 sets is Maintaining, 4 is Growing, 9.99 is Growing, 10 is Productive, 20 is Productive and 20.25 is High. Weekly sets are rounded to nine decimal places, as before, so floating point drift never moves a muscle across an edge.

Sources, as Zee's ruling cites them:

- Pelland et al., "The Resistance Training Dose-Response", SportRxiv 460 (2024), published in Sports Medicine (2025): about 4 fractional sets a week is the minimum effective dose.
- Bickel, Cross and Bamman (2011), "Exercise dosing to retain resistance training adaptations in young and older adults": about a ninth of the building volume held size for 32 weeks in young adults.
- Schoenfeld, Ogborn and Krieger (2017), the dose-response meta-analysis.
- Stronger by Science, "When does training volume reach the point of diminishing returns?": about 20 sets a week.
- Jeff Nippard's volume guidance: 10 to 12 hard sets, his summaries of Pelland and Schoenfeld.

The app's effort weighting already counts indirect work at about half a set, which matches Pelland's fractional method, so counting does not change.

### What it changes

- **Statuses.** The volume statuses are `not_trained`, `maintaining`, `growing`, `productive` and `high`, in that order, and the body map encodes them as their index in `VOLUME_STATUSES` (0 to 4). The statuses `under`, `over` and `not_targeted` are gone from the Volume view. A muscle with no value on the volume scale is drawn Not trained, which is index 0.
- **Ruling E is superseded for the Volume view.** KEY-339 ruling E made a muscle the plan and the goal do not train `not_targeted` where it would have been `under`. Zero sets is now Not trained whether or not the plan targets the muscle, and the targeted set no longer changes a volume status. `muscleState`, `weeklyVolume`, `projectedState` and `volumeValues` take no targeted argument. The Gap view keeps its own "Not in plan", decided by `gapValues` from `targetedMuscles`, which is unchanged. `useMuscleState` reads no routine and no goal, since nothing in it depends on them.
- **Colours.** The volume palette is five tokens, `volume-not-trained`, `volume-maintaining`, `volume-growing`, `volume-productive` and `volume-high`, in both themes. The colours are option B of 2026-10-27 (KEY-736), grey for Not trained and then blue, green, yellow and red, from Maintaining to High, and the scale is not diverging. `volume-under` and `volume-over` are retired. The gap scale draws "Not in plan" in the Not trained colour, as it drew it in the not targeted colour.
- **The muscle sheet.** The weekly sets bar runs from 0 to 24 sets with a tick and a number at 4, 10 and 20, fills in the colour of the band, and has no target band and no Min, Planned or Max labels. A muscle with no sets done and none planned this week gets the Not trained sheet, which says so and offers Edit routine and no Edit goal. Any other muscle gets the sheet with the bar.
- **Suggestions.** `suggestSession` scored a muscle as `priority × max(0, MAV low − sets) × (1 − heat)`. Under v2 a muscle is scored against where Productive starts, 10 sets, so `MAV low` becomes 10 for every muscle. A small or large muscle already had 10, so only the medium muscles (chest, lats, traps, glute_med and adductors) move, from 12 to 10. The goldens were worked again by hand with that target. The reason data keeps the name `mav_low` for the number a muscle was scored against, because stored suggestions carry it and the schema of a stored reason reads it.

### What it overrides

- "The heat model (pure, versioned)": the sentence on chronic load that compares `weeklySets` with the landmarks `MEV ≤ MAV ≤ MRV` to give `under | maintaining | productive | over`, and the sentence that follows it on the fifth status `not_targeted`. The numbers in the table of starting values for MEV, MAV and MRV are the record of `keylow-training-v1`. The columns τ, C and θ are unchanged and are v2's as well.
- The same section's list of functions: `muscleState(sets, now, params, targeted?)`, `weeklyVolume(sets, asOf, params, targeted?)` and the `projectedState` argument lose their optional trailing argument.
- "Goals and suggestions": "`MAV_low − weeklySets`" reads "where Productive starts, 10, less `weeklySets`".
- "The body map": "`volume` is diverging (blue under, green productive, red over)". The volume scale is five bands and is no longer diverging (see Colours above).

### Versions

- A change to `TrainingParams` values is a new version, never an edit of `keylow-training-v1` (the "Consequences" of this ADR and ADR 0002). `TRAINING_PARAMS_V1` stays in `params.ts` as the record of what v1 held, with its test, and nothing computes with it any more. `COMPARE_PARAMS_V2` and `SUGGEST_PARAMS_V2` carry the v2 training params and version, and replace `COMPARE_PARAMS_V1` and `SUGGEST_PARAMS_V1`, which held the v1 training params.
- The goal presets, the session time numbers and the nutrition proposals did not change, so they keep `keylow-training-v1`, and `training_goals.params_version` still records it for a goal saved before or after this amendment. A row already saved keeps the version it was written with. An `accepted_suggestions` row made before this amendment says `keylow-training-v1` and keeps its `mav_low` numbers as they were. A suggestion made after it says `keylow-training-v2`.
- Nothing about volume status is persisted, so no migration is needed.

### Interpretations made for implementation

These are not Zee's rulings:

- That `suggestSession` scores against where Productive starts (10), and not against Growing (4), which would leave almost every muscle already satisfied.
- That the sheet's Not trained case is chosen by no sets done and none planned, and not by the Not trained status of the view alone, so a muscle with sets planned but none done yet still shows its bar.
- That the bar's track runs to 24 sets, the number the `body · muscle-sheet` board draws.

### Implemented by

- KEY-727, this amendment, core, tokens and the mobile app.
- The web twin of the Volume view waits in MWEB. Web reads the same core.
