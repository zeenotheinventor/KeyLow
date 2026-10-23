# 0002: Adaptive engine shape, keylow-engine-v1

## Status

Accepted, 2026-09-22. Amendment 1 appended 2026-10-23.

## Context

The adaptive engine (trend weight, expenditure estimate, weekly auto-adjusting targets) is implemented in M6, but its shape, parameter contract and execution path need to be frozen before then, so that the data model (`expenditure_snapshots`, `targets`) and the edge function pipeline that M2 through M5 build around it do not shift underneath M6. This ADR documents the decision. It implements nothing.

## Decision

### Pure functions, one versioned parameter object

Trend, expenditure and targets are pure functions: `computeTrend`, the expenditure measurement and update step, and `deriveTargets`. Everything in `packages/core/src/engine/**` is pure: no IO, no `Date.now()`, no randomness. Dates are `YYYY-MM-DD` in the user's timezone; kg and kcal internally.

Every tunable lives in one `EngineParams` object with `version: 'keylow-engine-v1'`, persisted on every snapshot and target row so retuning never rewrites history.

### EngineParams defaults

Defaults: trend `alpha 0.10, winsorPct 0.025, rejectPct 0.15, winsorMinObs 5, maxGapDays 30`; expenditure `energyDensity 7700 kcal/kg, windowDays 28, minSpanDays 14, minWeighDays 8, minCompleteDays 10, residualSdFloorKg 0.3, intakeCvPerDay 0.15, incompletePenaltyKcal 100, priorCv 0.15, processSdKcalPerWeek 75, maxWeeklyChangeKcal 250, z clamp 800..6000`; targets `floorAbsKcal 1200, floorBmrFactor 0.9, maxDeficitFrac 0.30, maxSurplusFrac 0.20, maxLossPct 1.0/wk, maxGainPct 0.5/wk, round to 10, proteinMax 3.0 g/kg, fatMin 0.5 g/kg`.

The golden-number tables that verify the trend, expenditure and target maths against worked examples are not copied into this ADR. See the Build Plan & Engineering Context document's Adaptive engine section for those.

### Check-in execution

Edge Function `run-checkin` (core bundled for Deno), keyed by `(user_id, as_of_date)` and idempotent. Triggered by the client on app open when `today >= programs.next_checkin_date` and by a daily pg_cron backstop. Pipeline: `computeTrend`, then `DayInput[]` from `day_totals` + `day_logs.is_complete`, then `measureExpenditure`, `updateExpenditure`, `deriveTargets`, then insert an `expenditure_snapshots` row and a new `targets` row closing the previous one. Editing the program reruns `deriveTargets` immediately against the current state. Clients get select-only on snapshots and targets; the function writes with the service role.

### Deno bundling, with a fallback

Core is shared into Deno by esbuild-bundling `@keylow/core` into `supabase/functions/_shared/core/` (gitignored; Turbo task `bundle-core` before serve and deploy). Fallback if that gets brittle: publish core to GitHub Packages and import via `npm:`.

## Consequences

- M6 implements `packages/core/src/engine/**` against this shape. This ADR fixes the function boundaries (`computeTrend`, the expenditure step, `deriveTargets`) and the purity rule (no IO, no `Date.now()`, no randomness). M6 does not renegotiate them.
- A change to `EngineParams` values is a new version, not an in-place edit of `keylow-engine-v1`, because snapshot and target rows persist the params they were computed with and must stay reproducible.
- The golden-number tables stay in the Build Plan & Engineering Context document rather than being duplicated here, so a maths correction updates the document, and this ADR only changes if the engine's shape or the versioning rule changes.
- If esbuild-bundling core into Deno becomes brittle, the next step is the documented fallback (a published package imported via `npm:`), not an ad hoc workaround.

## Amendment 1 (The starting estimate, 2026-10-23)

### Status

Recorded on 2026-10-23 under KEY-594, part of KEY-6 (the M6 brief). It implements Zee's rulings of 2026-10-23 on the setup wizard, quoted below. The wizard computes the engine's starting estimate months before M6's check-in exists, so the starting state, which the Build Plan already specifies ("Initial state from Mifflin-St Jeor × activity factor"), and the way the wizard uses it are written down here, before the code. The details the Build Plan and the rulings leave open are interpretations made for implementation. They are, in full:

- that `muKcal` is clamped to 800 to 6000 kcal, the engine's `z` clamp, which the Build Plan names for the measurement and not for the prior.
- the optional `activityFactor` override and its band of 1.2 to 1.9.
- that `bmrKcal`, `muKcal` and `varKcal2` are not rounded, and that age is a whole number of completed years.
- that the values this amendment lists are added to `EngineParams` without a new version.
- what happens when protein and the fat floor do not fit in the calories (interpretation 2 of `deriveTargets`).
- that the wizard caps calories at 6000, in the setup layer.
- that the wizard writes the profile's manual target columns, that it also records the weight it was given as a `manual` weigh-in, the order in which it saves (weigh-in, program, profile last), that the escape "I'll set my own targets" only marks the account set up, and that nothing about the prior is stored.
- that M6's first snapshot takes this estimate as its prior.
- that the safety rules are product rules in `@keylow/core/setup` and not engine guardrails, and that the database does not enforce them.

Decided by the orchestrator on review, 2026-10-23. These are not Zee's rulings:

- that `initialExpenditure` returns `{ bmrKcal, muKcal, varKcal2, activityFactor }`, where `activityFactor` is the factor actually used.
- that the new `expenditure` and `targets` groups of `EngineParams` hold only the values `initialExpenditure` and `deriveTargets` use, and M6 adds the measurement and update params later.
- interpretation 1 of `deriveTargets`: every bound that rounding to 10 respects, with no rounding allowance.
- interpretation 3 of `deriveTargets`: a `lose` goal whose floor is above `tdee`.
- that `profile_max` is not an engine clamp but belongs to the setup layer's clamp list in `@keylow/core/setup`.
- that the wizard skips the weigh-in whenever the weight entered equals the value of the user's latest weigh-in, not only today's.
- that the floor applies to the `lose` goal only.
- that how M6 sets the prior for an account with no stats is open.

The first list comes from the KEY-594 ticket's plan and the second was decided on review. Neither list is a ruling of Zee's: his rulings are quoted below, and he can overturn any interpretation here by a later amendment. The frozen Decision text is unchanged. The function boundaries (`computeTrend`, the expenditure step, `deriveTargets`), the purity rule and `keylow-engine-v1` stay as they are. This amendment adds no function boundary and changes no value.

### Zee's rulings

Zee, 2026-10-23, approved the ten recommended setup wizard answers on KEY-6 and KEY-594:

> "Yes, start M6 in its own session now, with the ten recommended setup wizard answers."

The answers, as approved, quoted in full:

> 1. Questions. Sex (female, male, prefer not to say), date of birth, height, weight, one activity question with five levels, goal, rate, protein (moderate 1.6, high 2.0, very high 2.2 g/kg) and diet style (balanced, low fat, low carb). No keto, training type or workouts per week.
> 2. Existing users. No forced wizard. Existing accounts are marked set up, and "Estimate my targets" on Targets runs the wizard prefilled.
> 3. Body fat. Not asked.
> 4. Safety.
>    - Under 18 from the birth date: no "lose" goal, with a line to talk to a professional.
>    - Under 13: not accepted.
>    - Pregnancy and breastfeeding: a note on the goal step, with no question and nothing stored.
>    - The engine guardrails apply to everyone and are shown when they change the result.
> 5. Web. Mobile first. Web boards and tickets (W1 to W3) come after the mobile wizard has shipped and Zee has used it.
> 6. Escape. First run offers "I'll set my own targets". Single questions cannot be skipped.
> 7. Rates. Lose 0.25, 0.5, 0.75 or 1.0% a week, default 0.5. Gain 0.1, 0.25 or 0.5% a week, default 0.25. Each is also shown as kg (or lb) a week.
> 8. Check-in weekday. Not asked now. M6 decides it.
> 9. Landing. First run ends on the Diary. A recalculation returns to Targets.
> 10. Milestone. The tickets are filed under M6, and the non-UI tickets start now.

"Prefer not to say" is stored as `other` (BMR offset −78, the mean), as the KEY-594 comment of the same date records. The database side of these answers (the profile fields the wizard writes and the `programs` table) is ADR 0003, Amendment 12.

### BMR

`bmrMifflinStJeor({ sex, ageYears, heightCm, weightKg })` is the Mifflin-St Jeor equation:

`BMR = 10·kg + 6.25·cm − 5·age + s`

| `sex`    | `s`  | Note                                                        |
| -------- | ---- | ----------------------------------------------------------- |
| `male`   | +5   |                                                             |
| `female` | −161 |                                                             |
| `other`  | −78  | The mean of the two, as the Build Plan says: (5 − 161) ÷ 2. |

The wizard's "prefer not to say" is stored and passed as `other`. The result is not rounded: the Build Plan's own golden is 1370.25.

### Activity factors

| `activity` (the `activity_level` enum of ADR 0003, Amendment 12) | Factor |
| ---------------------------------------------------------------- | ------ |
| `sedentary`                                                      | 1.2    |
| `light`                                                          | 1.375  |
| `moderate`                                                       | 1.55   |
| `very`                                                           | 1.725  |
| `extra`                                                          | 1.9    |

The wording of the five levels in the wizard is user-facing copy, not part of this contract.

### `initialExpenditure`

`initialExpenditure` takes the BMR inputs, the activity level and an optional `activityFactor`, and returns `{ bmrKcal, muKcal, varKcal2, activityFactor }`:

- `bmrKcal` is `bmrMifflinStJeor` of the inputs.
- `muKcal = clamp(bmrKcal × factor, 800, 6000)`. The factor is the one for the activity level, unless `activityFactor` is given.
- `varKcal2 = (priorCv · muKcal)²`, with `priorCv` 0.15. This is the Gaussian state the Build Plan describes: `mu = TDEE_0, var = (0.15·TDEE_0)²`.
- `activityFactor` in the result is the factor actually used: the factor of the level, or the override after it has been clamped to the band 1.2 to 1.9.
- The `activityFactor` input replaces the factor of the level and is itself clamped to the band 1.2 to 1.9. It is the interface point KEY-338 (T7, item 4) asks for, so that training can refine the factor later without a new engine version. Nothing sets it in v1.

The exact parameter shape is KEY-595's. The numbers are the contract.

Worked examples, which the tests of KEY-595 use. The Build Plan's golden table stays the source, and a correction there wins over this text:

- Male, 35 years, 80 kg, 180 cm: BMR = 10·80 + 6.25·180 − 5·35 + 5 = 800 + 1125 − 175 + 5 = 1755. At `light`, mu = 1755 × 1.375 = 2413.125 (2413.1 to one decimal), and var = (0.15 × 2413.125)² = 361.96875² = 131 021.4.
- Female, 30 years, 65 kg, 165 cm: BMR = 650 + 1031.25 − 150 − 161 = 1370.25. At `moderate`, mu = 1370.25 × 1.55 = 2123.8875 (2123.9 to one decimal).
- The same male as `other`: s = −78, so BMR = 800 + 1125 − 175 − 78 = 1672, and at `light` mu = 1672 × 1.375 = 2299. This one follows from the formula and is not a Build Plan golden.

### Age

Age is an input in whole years, meaning completed years. The caller computes it from the birth date for a given date. Nothing in the engine reads the clock, so the purity rule stands.

### `EngineParams` additions

M6 extends `EngineParams` (it holds only `trend` today) with an `expenditure` group and a `targets` group. The two groups hold the values `initialExpenditure` and `deriveTargets` use:

- from this ADR's "EngineParams defaults": `energyDensity`, `priorCv` and the `z` clamp of 800 to 6000 (which `initialExpenditure` applies to `muKcal`), and every `targets` default.
- the three BMR offsets, the five activity factors and the factor band of 1.2 to 1.9.
- the protein presets (1.6, 2.0 and 2.2 g/kg) and the fat fractions of the remainder, keyed `balanced` (0.40), `low_fat` (0.28) and `low_carb` (0.60), from the Build Plan's Targets section.

The measurement and update params (`windowDays`, `minSpanDays`, `minWeighDays`, `minCompleteDays`, `residualSdFloorKg`, `intakeCvPerDay`, `incompletePenaltyKcal`, `processSdKcalPerWeek` and `maxWeeklyChangeKcal`) are added with M6's measurement and update functions, later.

These are values this ADR and the Build Plan already froze, and no value differs from them, so `keylow-engine-v1` keeps its version. This is not a retune. No snapshot or target row exists yet to be made unreproducible. The names of the keys are KEY-595's, KEY-597's and KEY-598's call.

### `deriveTargets`

`deriveTargets` is implemented as the Build Plan specifies, without day-of-week offsets. M6 adds them, and the `programs` schema already holds them (ADR 0003, Amendment 12). The Build Plan's goldens are the tests. Three points that the Build Plan does not settle are recorded here:

1. **Rounding never breaks a bound.** Calories are rounded to the nearest 10. After that, a result below the max-deficit bound (70% of `tdee`) is stepped up by 10 until it is at or above it. A result above the max-surplus bound (120% of `tdee`) is stepped down by 10 until it is at or below it. A result below the floor is stepped up by 10 until it is at or above the floor. A result above the profile maximum (6000, applied by the setup layer, see "How the wizard uses it") is stepped down by 10 until it is at or below it. So the deficit never exceeds 30% and the surplus never exceeds 20%, exactly, with no rounding allowance.
2. **When protein and the fat floor do not fit in the calories**, the fat floor wins. Protein is reduced to what fits after the fat floor, carbs are 0, and a `macro_fit` clamp is recorded.
3. **A `lose` goal whose floor is above `tdee`.** The floor applies to the `lose` goal only. When it is above `tdee`, the floor wins, so the calories may exceed `tdee`. The `floor` clamp is recorded. `effectiveRatePctPerWeek` is the true signed value, where positive means movement in the goal's direction, so here it is negative. The property is that a `lose` result never exceeds `max(tdee, floor)`. For example, a woman of 50 years, 150 cm and 40 kg at `sedentary` has BMR = 400 + 937.5 − 250 − 161 = 926.5 and `tdee` = 926.5 × 1.2 = 1111.8. The floor is `max(1200, 0.9 × 926.5)` = 1200, so a `lose` result is 1200, above `tdee`. The guardrail line on the estimate screen tells the user. A `maintain` or `gain` result is never below `tdee` rounded to 10, so the range's lower bound of 800 holds through the `muKcal` clamp.

### How the wizard uses it

1. The wizard calls `initialExpenditure` with the stats the user entered and the activity level.
2. It calls `deriveTargets` with `tdee = muKcal`, `trendWeight` = the weight the user entered (there is no trend yet), `bmr = bmrKcal`, and the goal, rate, protein preset and diet style the user chose.
3. The setup layer caps calories at 6000, so that they fit `profiles_target_kcal_range` (ADR 0003, Amendment 4). A cap that bites is recorded as a `profile_max` clamp. `profile_max` is not an engine clamp. It belongs to the setup layer's clamp list in `@keylow/core/setup`, and the clamps of the `startingPlan` result are the engine's `Clamp` values plus `profile_max`. The range's lower bound of 800 holds because the floor for `lose` is never below 1200, and because `maintain` and `gain` are never below `tdee` rounded to 10, and the `muKcal` clamp keeps `tdee` at 800 or more.
4. It saves, in this order: a `manual` weigh-in of the weight entered, for today (skipped whenever the weight entered equals the value of the user's latest weigh-in, so a recalculation does not write a stale value dated today), then the program, then the profile last. The profile update carries the stats (which include `onboarding_weight_kg`, the weight entered), the result as the manual target columns (ADR 0003, Amendment 4), which the diary already reads, and `onboarding_completed_at`. A failure before the profile leaves the account not set up, so the user can try again. The full order and the retry rule are in ADR 0003, Amendment 12, "How the wizard saves".
5. Nothing about the prior is stored now. Guardrails that changed the result (the deficit cap, the floor, the surplus cap, the rate cap, `macro_fit`, `profile_max`) are shown to the user, by Zee's ruling 4.

A recalculation ("Estimate my targets" on Targets) runs the same steps from the stored stats, prefilled, and updates the active program in place.

The first-run escape, "I'll set my own targets" (Zee's ruling 6), runs none of these steps. It only marks the account set up, as ADR 0003, Amendment 12, "How the wizard saves", records.

### What M6 does with it

M6's first snapshot for a user takes `initialExpenditure` of the profile's stats, `onboarding_weight_kg` and the age on the snapshot's date as its prior. The function is deterministic, so the prior matches what the wizard showed whenever the inputs have not changed. M6 does not need the wizard to store `mu`.

### Not in v1

- Katch-McArdle and any body fat input (out of scope in KEY-6, and Zee's ruling 3 is that body fat is not asked).
- A training-derived activity factor (KEY-338, T7). The `activityFactor` override is the interface point and nothing sets it.

### Safety rules

These are product rules, not engine guardrails. They live in `@keylow/core/setup`, not in the engine, and the database does not enforce them:

- Under 18 (from the birth date) the goal "lose" is not offered, and the user gets a line to talk to a professional. The program screen's edit applies the same rule through `goalsAllowed` in `@keylow/core/setup`.
- An age under 13 is not accepted.
- Pregnancy and breastfeeding get a note on the goal step and no question, so nothing is stored.
- The engine's own guardrails (30% deficit, 20% surplus, the floor `max(1200, 0.9·BMR)`, the rate caps) apply to everyone.

KEY-6's health data rules (Zee, 2026-10-14) apply to the wizard. Profile stats, goals and derived values are health data, they are collected only because the engine uses them, and an estimate is labelled as an estimate. How the not-medical-advice note and the estimate label are worded is the design's call.

### Open

- The check-in weekday. Zee's ruling 8 is that M6 decides it. The wizard sets no `checkin_weekday` and no `next_checkin_date`.
- The web wizard. Zee's ruling 5 puts the web boards and tickets (W1 to W3) after the mobile wizard has shipped and Zee has used it.
- Day-of-week offsets in `deriveTargets`. M6 adds them.
- The prior for an account with no stats. An existing account marked set up with null stats, and a user who took the escape, has nothing to compute `initialExpenditure` from. M6 decides what its first snapshot uses.
- The fat floor on its own can exceed the calories, but only at very high weights. Point 2 of "`deriveTargets`" does not say what the macros are then. KEY-598 raises it before it builds the case.

### Implemented by

- KEY-595: `bmrMifflinStJeor` and `initialExpenditure`, with the `expenditure` params.
- KEY-597 and KEY-598: `deriveTargets` (calories, then macros and the composed function), with the `targets` params.
- KEY-596: the `@keylow/core/setup` model, which holds the safety rules.
- KEY-599: `startingPlan`, which composes the steps in "How the wizard uses it".
- KEY-600: the database side, ADR 0003 Amendment 12.
- KEY-601 and KEY-602: the api-client hooks that read and save the setup.
- KEY-603: the design gate for the wizard screens.

### Consequences of Amendment 1

Core builds `bmrMifflinStJeor`, `initialExpenditure` and `deriveTargets` to the numbers above, and the Build Plan's goldens turn them into tests. M6 inherits the starting estimate and does not renegotiate it. Any further deviation from the frozen Decision or from this amendment needs an Amendment 2 before the code that implements it lands.
