# 0005: Workout tracking, muscle heat model and body map, keylow-training-v1

## Status

Proposed, 2026-10-17. Accepted when Zee approves the pull request that carries it.

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

Chronic load: `weeklySets_m` is the effort-weighted set count of the last 7 days, compared with volume landmarks `MEV_m ≤ MAV_m ≤ MRV_m` to give `under | maintaining | productive | over`.

Starting values, by size class (to be tuned; they are a starting point, not settled physiology):

| Size class | Muscles                                                                 | τ (h) | C (sets) | MEV | MAV      | MRV |
| ---------- | ----------------------------------------------------------------------- | ----- | -------- | --- | -------- | --- |
| small      | delts, biceps, triceps, forearms, calves, tibialis, neck, abs, obliques | 24    | 8        | 6   | 10 to 16 | 22  |
| medium     | chest, lats, traps, glute_med, adductors                                | 32    | 10       | 8   | 12 to 18 | 22  |
| large      | quads, hamstrings, glute_max, lower_back                                | 40    | 10       | 6   | 10 to 16 | 20  |

`θ = 0.25 × C_m`. A per-muscle override map exists in the params for when one muscle needs to differ from its class.

Functions: `muscleState(sets, now, params)` returns `{ heat, readyAt, weeklySets, volumeStatus }` per muscle id; `weeklyVolume(sets, asOf, params)`; `expandPlan` and `compareWeek` (below); `suggestSession(state, goals, library, constraints, params)`.

### Projected against actual

Two views of the same week, drawn with the same maths:

- **Actual** comes from the logged sets.
- **Projected** comes from the plan: the active routine's days placed on their weekdays for the week, each routine exercise expanded into `target_sets` planned sets at `target_rir`, with the snapshot taken from the exercise's current muscle map. A planned session the user has already logged is replaced by its actual sets; a planned day that passed without a session stays in the projection, so a missed day shows as a gap.

`expandPlan(routine, weekStart, tz, params)` returns planned sets of the same shape as logged sets (marked `planned: true`), so `muscleState` and `weeklyVolume` run on them unchanged. `compareWeek(actual, projected)` returns, per muscle, the actual weekly sets, the projected weekly sets and the gap, with status `behind | on_plan | ahead` (on plan within a params tolerance of 1 set). Heat can be shown for any day of the week in both views: actual heat uses sets up to that moment, projected heat assumes the plan was followed up to that moment. Suggestions from T5 accepted into a day count as planned.

It runs on the client. The input is a few hundred sets at most, so unlike the nutrition check-in there is no Edge Function and nothing derived is persisted. A daily snapshot table can be added later if history charts need it.

### Goals and suggestions

The goal questionnaire writes `training_goals`. `muscle_priority` is derived in core from the answers through preset maps, versioned with the params: `aesthetic` with `v_taper` raises `delt_side`, `lats` and `chest_upper` and lowers direct `obliques` work; `strength` raises the muscles of the squat, bench, deadlift and overhead press and switches rep targets to lower ranges with load progression.

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

Two colour scales: `heat` is sequential (neutral at rest, through amber, to red at full heat, with a matching glow); `volume` is diverging (blue under, green productive, red over). `gap` is diverging around the plan (blue behind plan, neutral on plan, amber ahead of plan). The colours come from `@keylow/tokens` and are checked for contrast in light and dark.

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

Training logs are health data under the project's Working conventions: no exercise name, load, reps or muscle value in logs, error reports or analytics (ids and counts only). Training tables are in the data export and are removed by account deletion.

## Consequences

- The training milestones implement the tables, `packages/core/src/training/**` and the `BodyMap` contract above without renegotiating them. The column lists here are a forward contract in the same sense as ADR 0003.
- A change to `TrainingParams` values or the preset priority maps is a new version, not an edit of `keylow-training-v1`.
- The muscle id list is shared by the database seed, core, the SVG and the 3D asset. Changing it means a new list version and a matching asset update.
- Training-aware calories never edit `keylow-engine-v1`; they are a separate layer with its own version, and a change to its params is a new `keylow-fuel` version.
- The 2D map ships before the 3D model, so the 3D work is a renderer swap and never blocks the tracker.
- Choosing the 3D source model and its licence is a human decision recorded before the 3D milestone starts.
