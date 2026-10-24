# 0002: Adaptive engine shape, keylow-engine-v1

## Status

Accepted, 2026-09-22. Amendment 1 appended 2026-10-23. Amendment 2 appended 2026-10-23.

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
3. **A `lose` goal whose floor is above `tdee`.** The floor applies to the `lose` goal only. When it is above `tdee`, the floor wins, so the calories may exceed `tdee`. The `floor` clamp is recorded. `effectiveRatePctPerWeek` is the true signed value, where positive means movement in the goal's direction, so here it is negative. The property is that a `lose` result never exceeds the larger of `tdee` rounded to the nearest 10 and the floor rounded up to a multiple of 10. For example, a woman of 50 years, 150 cm and 40 kg at `sedentary` has BMR = 400 + 937.5 − 250 − 161 = 926.5 and `tdee` = 926.5 × 1.2 = 1111.8. The floor is `max(1200, 0.9 × 926.5)` = 1200, so a `lose` result is 1200, above `tdee`. The guardrail line on the estimate screen tells the user. A `maintain` or `gain` result is never below `tdee` rounded to 10, so the range's lower bound of 800 holds through the `muKcal` clamp.

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
- Resolved in KEY-598: the fat floor on its own can exceed the calories, but only at very high weights (at 1200 kcal, above 266 kg). The macros are then fat = `floor(calories / 9)` g, protein 0 g and carbs 0 g, and a `macro_fit` clamp is recorded, so the macros never exceed the calories.

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

## Amendment 2 (The weekly check-in, 2026-10-23)

### Status

Recorded on 2026-10-23 under KEY-604, part of KEY-6 (the M6 brief, scopes 2, 3, 4 and 6). It implements Zee's answers of 2026-10-23 to the open questions Q1 to Q8, recorded below. The frozen Decision fixes the check-in's shape (`measureExpenditure`, `updateExpenditure`, `deriveTargets`, `run-checkin`, a snapshot and a targets row) and the Build Plan fixes its maths and goldens. Neither settles the measurement window's edges, the schedule, catch-up, the start snapshot, the trend weight the targets use, or who wins between the manual targets and the engine's. Every core, database and function ticket of M6 implements these words, so they are written down first. ADR 0003, Amendment 13, holds the database side. The details the Build Plan and the answers leave open are interpretations made for implementation. They are, in full:

- the edges of the measurement window (`as_of − 28` to `as_of − 1`, the check-in day itself excluded), which weigh-ins count (the trend's real, accepted days, entering at `usedKg`), that `spanDays` counts both ends, and what a complete day is.
- the result shapes of `measureExpenditure` (an ineligible result with its `reasons` and the three counts, an eligible one whose `rKcal2` is already inflated by `spanDays / 7`), and that the residual standard deviation uses `n − 2` degrees of freedom.
- that `completeFrac` is measured from the first day with any data, and not over all 28 days.
- that `updateExpenditure` also returns `gain`, `rawStepKcal`, `stepKcal` and `stepClamped`, and that without a measurement `mu` is unchanged and `var` becomes `P`.
- the schedule: the first check-in 14 days after the schedule is set, then every 7 days, and what a user's "today" is.
- the start snapshot: that it takes `initialExpenditure` of the profile's stats, `onboarding_weight_kg` and the age on its date, when a new one is written (no snapshot, or the newest is more than 28 days old), and that while the user is still settling every recompute rewrites it in place.
- that the schedule is set whenever the active program's `next_checkin_date` is null, which covers a new program after an ended one.
- that a recompute derives targets from the newest snapshot's `mu`, the trend weight on yesterday (the onboarding weight when there are no weigh-ins) and the active program, then applies the app's 6000 cap, and writes a new targets row.
- the day-of-week offsets: index 0 is Monday, `calories + offsets[i]` rounded to 10, the floor for `lose` only, every day within 800 to 6000, the same check as `programs.dow_offsets_kcal`, macros weekly, and the contract of `dayTarget`.
- the key sets of a snapshot's `measurement` and of a targets row's `basis`, that `effectiveRatePctPerWeek` is the true signed value, and that the 6000 cap is applied in the check-in layer and recorded as `profile_max`.
- the `run-checkin` contract: three modes, their answers, idempotency on `(user_id, as_of_date)`, and what is logged.
- that no snapshot is ever made without stats, and that a program with missing stats answers 409 `missing_stats` and writes nothing.

Zee's answers, 2026-10-23, recorded below, settle these. They are rulings, and the interpretations above only make each concrete:

- Q1, that the check-in weekday is the weekday the user set up ("The schedule").
- Q2, that a user back after missed weeks gets one check-in per missed week ("Catch-up").
- Q3, that the targets use the trend weight, so the end-to-end gate is 2140 kcal / P 126 / F 73 / C 245 and 2150 / 126 / 73 / 247 stays as `deriveTargets`' unit golden ("The trend weight the targets use" and "Golden numbers").
- Q4, that during settling a recalculation restarts from the new answers and after the first measurement it keeps the measured expenditure ("The start snapshot and the schedule").
- Q5, that an active program's targets win and saving your own targets ends the program ("Engine targets and manual targets").
- Q6, an 80 % confidence band ("The confidence band").
- Q7, that the backstop runs hourly at minute 17 ("The backstop").
- Q8, that the "six complete days" gate case is a check-in whose 28-day window has fewer than 10 complete days ("Golden numbers").

The ticket's text was also updated on 2026-10-23, after the KEY-594 review, in four places, and Q1 to Q8 did not change. These are not Zee's rulings: the 6000 cap and `profile_max` in the check-in layer ("Recompute" and "The 6000 cap"), the floor for day-of-week offsets on `lose` only ("Day-of-week offsets"), the schedule of a new program ("The start snapshot and the schedule"), and the no-stats prior ("The prior for an account with no stats").

Decided by the orchestrator on review, 2026-10-23. These are not Zee's rulings:

- that the figures quoted in "Golden numbers" are the ones the rules produce, which differ in the last digit from some of the Build Plan's intermediates, and the per-column tolerances that make both sets pass. Also that the golden has a residual sd of 0, so it exercises four rules that each of KEY-606 and KEY-607 tests with its own literal.
- that a day raised to the floor is stepped up by 10 until it is at or above it, as Amendment 1 does for the week, and not set to the floor's exact value, which need not be a multiple of 10.
- that keeping a day within 800 to 6000 records a clamp `dow_range`, because Zee's ruling 4 (Amendment 1) is that guardrails that change a result are shown.
- that a check-in with no weigh-in at all uses the onboarding weight as its trend weight, as a recompute does.
- that the input of `computeTrend` is cut at `as_of − 1`, so an on-time run, a late run and a run on the check-in day give the same answer, and idempotent means a pure function of the data up to `as_of − 1`.
- that there is one schedule rule (the user's today at the moment the schedule is set, plus 14 days, with `started_on` not used), and that an invalid time zone name is read as UTC.
- that a call runs at most 8 catch-up check-ins for a user.
- that a recompute restarts from the new answers only while the start snapshot is the user's newest snapshot, and that once any `checkin` snapshot exists, eligible or not, `mu` is kept.
- that the floor's BMR in a check-in is Mifflin-St Jeor of the profile's stats with `onboarding_weight_kg` and the age on `as_of_date`.
- that a measurement is a union discriminated on `eligible`, and an ineligible one has no update fields.
- that macros after the cap are re-derived for the capped calories, and that stored macro grams are whole grams, rounded to nearest.
- that the measurement and update params, which Amendment 1 said M6 adds later, are added now without a new version.
- that the confidence band's factor is 1.2816, the two-sided 80 % value that "1.28" in the answer rounds.
- the response shapes and status codes of `run-checkin`, that `ran` counts check-ins recorded and not duplicates, that a bad mode answers 400 `bad_mode`, and that no active program answers 409 `no_program`.
- the backstop's credential and gateway rules: `verify_jwt = false` for `run-checkin`, the secret in `x-checkin-secret` compared in constant time, 401 when the secret is unset or empty, no JWT ever accepted as the backstop credential, and the secret never accepted in the other modes.
- that one backstop run handles at most the oldest 200 due users, and the hourly cadence drains the rest.
- that `run-checkin` reads `weigh_ins` with `deleted_at is null`.
- that after a `duplicate` answer from the writer, `run-checkin` re-reads the newest snapshot and `next_checkin_date` and continues from the stored values.

The frozen Decision text is not edited. Where it says "daily pg_cron backstop", Q7's hourly schedule wins. The function boundaries (`computeTrend`, the expenditure step, `deriveTargets`), the purity rule and `keylow-engine-v1` stay as they are. This amendment adds the measurement and update functions and the day-of-week rule to the engine and changes no value that ADR 0002 or the Build Plan froze.

### Zee's rulings

Zee's words on 2026-10-23, on KEY-604 and KEY-6, are one sentence:

> "Take all the recommended answers: Q1 to Q8 for the rest of M6 and the six setup canvas questions."

The orchestrator's record of the answers, on KEY-604, 2026-10-23. These are the recommended answers as they stand in the ticket, which that sentence took. They are not Zee's words:

- Q1: the check-in weekday is the weekday the user set up, the first check-in two weeks later, then weekly.
- Q2: one check-in per missed week, oldest first.
- Q3: the check-in uses the trend weight, so the end-to-end gate is 2140 kcal / P 126 / F 73 / C 245, and 2150 / 126 / 73 / 247 stays as `deriveTargets`' unit golden.
- Q4: during settling, a recalculation restarts from the new answers. After the first measurement, it keeps the measured expenditure.
- Q5: an active program's targets win, and saving your own targets ends the program.
- Q6: an 80% band.
- Q7: the backstop runs hourly at minute 17.
- Q8: the gate case is a check-in whose window has fewer than 10 complete days.

The orchestrator's record of the two KEY-6 acceptance criteria that these supersede, on KEY-6, 2026-10-23. It is not Zee's words:

- The end-to-end next-week target is 2140 kcal / P 126 / F 73 / C 245, because the check-in feeds `deriveTargets` the trend weight (79.02 kg on day 27). 2150 / 126 / 73 / 247 is that function's unit golden at the raw 78.65 kg.
- The "six complete days" case is a check-in whose 28-day window has fewer than 10 complete days.

The weekday was left to M6 by ruling 8 of the setup wizard answers (Zee, 2026-10-23, quoted in Amendment 1):

> "8. Check-in weekday. Not asked now. M6 decides it."

So the wizard does not ask for the weekday, whatever KEY-6's scope 5 listed, and Q1 is how M6 decides it.

KEY-6's health data rules (Zee, 2026-10-14) apply to every point below:

> "profile stats (sex, date of birth, height, activity), goals, expenditure snapshots and targets are health data, including the derived values. They are all used by the engine, so they are collected; nothing beyond them is. Rules for every sub-ticket: `run-checkin` logs user ids, counts and durations only, never intake, weight or expenditure values; the replay harness runs on seed or exported data, never against production; estimates are labelled as estimates and the program screen carries the not-medical-advice note."

### The measurement: `measureExpenditure`

1. **The window** is the 28 days before `as_of_date`, `as_of − 28` to `as_of − 1`, both ends included. The check-in day itself is never in it.
2. **Weigh-ins** are the trend's real, accepted days: `computeTrend` points with `rawKg` not null, not `interpolated` and not `rejected`, read at `usedKg`, so a winsorised reading enters clamped. The slope is an ordinary least squares line through them, `b` in kg a day.
3. **`spanDays`** is `last − first + 1` over those days, both ends counted. This is what makes the Build Plan's 14-point golden eligible, as its window holds 14 days.
4. **A complete day** is a day whose `day_logs.is_complete` is true and whose `day_totals.kcal` is not null. `meanIntakeKcal` is the mean of `day_totals.kcal` over complete days only.
5. **Eligibility** is `spanDays ≥ 14`, `weighDays ≥ 8` and `completeDays ≥ 10`. The result is a union discriminated on `eligible`. An ineligible result is `{ eligible: false, reasons, spanDays, weighDays, completeDays }`, where `reasons` is a subset of `span`, `weigh_days` and `complete_days`, in that order, and it has no update fields. Eligibility is per 28-day window and not per week (Q8), so a single week with six complete days, in a window that holds 10 or more, still measures.
6. **An eligible result** is `{ eligible: true, zKcal, rKcal2, slopeKgPerDay, seSlopeKg, meanIntakeKcal, spanDays, weighDays, completeDays }`:
   - `zKcal = meanIntakeKcal − b · 7700`, clamped to 800 to 6000.
   - `seSlopeKg = max(residual sd, 0.3) / √Σ(x − x̄)²`. The residual sd divides the sum of squared residuals by `n − 2`, where `n` is `weighDays`, and the floor is 0.3 kg.
   - `rKcal2 = ((7700 · seSlopeKg)² + (0.15 · meanIntakeKcal)² / completeDays + (100 · (1 − completeFrac))²) · spanDays / 7`. So `rKcal2` is R already inflated, because the weekly windows overlap, and the update step uses it as `R_eff`.
7. **`completeFrac`** is the complete days over the window's days from the first day with any data. A day has data when it holds a weigh-in of item 2 or a non-null `day_totals.kcal`. It is not complete days over all 28. The Build Plan's first golden check-in has 14 days of data and an `R_eff` of 62 467.8, which holds only with no penalty for the 14 days before the data began ("Golden numbers" shows both readings).

### The update: `updateExpenditure(prior, measurement)`

One process step per check-in: `P = var + 75²`.

- **With an eligible measurement**, the Kalman step: `K = P / (P + rKcal2)`, `rawStepKcal = K · (zKcal − mu)`, `stepKcal` is `rawStepKcal` clamped to ±250, `mu' = mu + stepKcal` and `var' = (1 − K) · P`. The result is the new state (`muKcal`, `varKcal2`, as in Amendment 1) and also `{ gain, rawStepKcal, stepKcal, stepClamped }`, where `gain` is `K` and `stepClamped` is true when the clamp changed the step. `mu'` needs no further clamp, because `zKcal` and the prior are both within 800 to 6000 and the step moves `mu` towards `zKcal` by a fraction of the way.
- **Without one** (the measurement is ineligible), `mu` is unchanged and `var = P`. The belief drifts, and a drifting belief gets less certain. The result has no `gain`, `rawStepKcal`, `stepKcal` or `stepClamped`.

Exact result field names are KEY-606's and KEY-607's call. The numbers are the contract.

### Golden numbers

The Build Plan's golden chain: prior 2500 / 140 625, weight exactly `80 − 0.05 · d`, intake 2200 on every day and all complete, `zKcal` 2585. A check-in on 14, 21 and 28 days after the day the schedule is set has a window holding 14, 21 and 28 points, from day 0, so every `completeFrac` is 1. A short script that implements the rules above reproduces the figures below. They are the values the rules produce, to the precision shown:

| Check-in (points) | Σ(x − x̄)² | `seSlopeKg` | `rKcal2` (R_eff) | `P`      | `K`     | `rawStepKcal` | `mu`    | `var`    |
| ----------------- | --------- | ----------- | ---------------- | -------- | ------- | ------------- | ------- | -------- |
| 14                | 227.5     | 0.0198898   | 62 467.9         | 146 250  | 0.70071 | 59.56         | 2559.56 | 43 771.7 |
| 21                | 770       | 0.0108112   | 36 347.1         | 49 396.7 | 0.57610 | 14.66         | 2574.22 | 20 939.4 |
| 28                | 1827      | 0.0070186   | 27 239.9         | 26 564.4 | 0.49372 | 5.32          | 2579.54 | 13 449.0 |

- The slope is −0.05 kg a day in all three, so `zKcal = 2200 + 0.05 · 7700 = 2585`. The residual sd is 0 and the 0.3 floor applies. No step reaches 250, so `stepClamped` is false.
- **Tolerances.** The tests of KEY-606 and KEY-607 compare each column of the table to these: `seSlopeKg` ±1e-7, `rKcal2` ±0.5, `gain` ±1e-5, `rawStepKcal` ±0.01, `P` ±0.1, and `mu` and `var` ±0.5 (the exit gate's ±0.5 kcal). Tests assert `rKcal2` directly and not only through `mu`.
- The Build Plan's own intermediates are 62 467.8 / 36 347.4 / 27 240.0 for R_eff, 43 771.3 for the first variance and 0.57609 for the second gain. They differ from the figures above by at most 0.4, in the last digit only, and every one is within the tolerance above. The Build Plan's table needs the same correction, and until it has one the figures here are the tests'.
- **What the golden does not exercise.** Its residual sd is 0, so it exercises none of the `n − 2` divisor, a winsorised `usedKg`, a `completeFrac` below 1, or the ±250 clamp. Each of KEY-606 and KEY-607 derives its own literal for those cases, independently of the module under test.
- The first check-in's `R_eff`, from the rules: `(7700 · 0.0198898)² = 23 455.4`, `(0.15 · 2200)² / 14 = 7 778.6`, and a penalty of 0, so R = 31 234.0, and `R_eff = 31 233.96 · 14 / 7 = 62 467.9`. If `completeFrac` were taken over all 28 days it would be 14 / 28 and the penalty would be `(100 · 0.5)² = 2 500`, so R would be 33 733.96 and `R_eff` would be 67 467.9, which is 5 000 above the table's 62 467.9. That is why item 7 of the measurement counts from the first day with data.
- **The trend weight on day 27** of the golden fixture is 79.0227 kg. It is the bias-corrected EWMA with α 0.10 of `80 − 0.05 · d` for `d` from 0 to 27, and it lags the raw 78.65 kg by 0.37 kg. The check-in on day 28 reads it as `trendKg` on `as_of − 1`.
- **The end-to-end next-week target** at the third check-in, a `lose` goal at 0.5 % a week, `tdee` 2579.54, BMR 1755, protein 1.6 g/kg and fat 0.40 of the remainder, with the trend weight 79.0227: `delta = 0.005 · 79.0227 · 7700 / 7 = 434.62`, raw `2579.54 − 434.62 = 2144.92`, rounded to 10 it is 2140. The 70 % bound is 1805.7 and the floor `max(1200, 0.9 · 1755)` is 1579.5, so no guardrail bites. Protein is `1.6 · 79.0227 = 126.44`, so 126 g, the remainder is `2140 − 4 · 126.44 = 1634.26`, fat is `0.40 · 1634.26 / 9 = 72.63`, so 73 g, and carbs are `(1634.26 − 9 · 72.63) / 4 = 245.14`, so 245 g. The result is **2140 kcal / P 126 / F 73 / C 245**.
- **`deriveTargets`' unit golden** at the raw weight 78.65 kg is the Build Plan's 2150 kcal / P 126 / F 73 / C 247: `delta = 432.575`, raw 2146.97, rounded 2150, protein 125.84, fat 73.18, carbs 247.00. It stays as the unit golden and is not the end-to-end figure (Q3).
- **The gate case for ineligibility** (Q8) is a check-in whose window has fewer than 10 complete days. The recommended fixture is the day-14 check-in with 9 complete days, which keeps `minCompleteDays` at 10 and the Build Plan unchanged. Its result is `{ eligible: false, reasons: ['complete_days'], ... }`, `mu` is unchanged and `var` grows to `P`.

### The schedule

There is one rule. The first check-in is the user's today, at the moment the schedule is set, plus 14 days (the two "settling" weeks the brief names), and then every 7 days. `programs.started_on` is not used for it. The check-in weekday is the weekday the user set up (Q1, ruling 8), which is the weekday of the day the schedule is set, stored as ISO 1 (Monday) to 7 (Sunday) in `profiles.checkin_weekday`. Since 14 and 7 are whole weeks it does not change.

A user's "today" is the date in `profiles.timezone`. That column is `text not null default 'UTC'` and a client can write it, so it is never null, and a name that is not a valid IANA time zone is read as UTC. All dates in the check-in are the user's local dates. A client can also write `next_checkin_date` (Amendment 12 grants it), so the engine reads whatever is stored.

### Catch-up

A check-in runs for `as_of_date = programs.next_checkin_date` while that date is on or before the user's today, one week at a time, oldest first (Q2). Each has its own process step. After each, `next_checkin_date` moves on by 7. A user back after three weeks gets three snapshots and three targets rows, the last one current, and each snapshot's belief carries the previous one's.

A call runs at most 8 check-ins for a user. When more are due, the `nextCheckinDate` in the answer is still on or before the user's today, which shows that more remain, and the backstop continues each hour. A repeat for the same `(user_id, as_of_date)` writes nothing (see "`run-checkin`").

### The trend weight the targets use

`computeTrend`'s `trendKg` on `as_of − 1`, the newest point on or before it (Q3). It is not the raw weigh-in and not the regression line's value. This is why the end-to-end figure on the golden fixture is 2140 and not 2150. When the user has no weigh-in at all, the onboarding weight stands in, as it does for a recompute. The snapshot's `trend_weight_kg` is then null, because it is not a trend, and the targets row's `basis.trendWeightKg` holds the onboarding weight that `deriveTargets` was given.

The input of `computeTrend` is cut at `as_of − 1`: it sees only weigh-ins dated on or before that day, and none that are soft-deleted. So an on-time run, a late run and a run on the check-in day give the same answer, and "idempotent" means that a check-in is a pure function of the data up to `as_of − 1`.

### The start snapshot and the schedule

1. The **start snapshot** is a snapshot with `kind = 'start'` and no measurement. It takes `initialExpenditure` of the profile's stats, `onboarding_weight_kg` and the age on `as_of_date` ("What M6 does with it", Amendment 1). Its `trend_weight_kg` is in ADR 0003, Amendment 13.
2. A **new one**, as of the user's today, is written when the user has no snapshot or the newest is more than 28 days old.
3. While the user is still **settling**, meaning the start snapshot is the user's newest snapshot, every recompute rewrites it in place (same `as_of_date`) from the current stats, so a recalculation in the first two weeks starts from the new answers (Q4). A start snapshot older than 28 days is not rewritten, because item 2 writes a new one.
4. Once any `checkin` snapshot exists, eligible or not, the user has been through a check-in, and a recalculation or an edit keeps the learned `mu` and only rederives targets (Q4). The writer refuses to replace a snapshot that is a `checkin` row (ADR 0003, Amendment 13).
5. A snapshot needs stats ("The prior for an account with no stats").
6. **The schedule** is set whenever the active program's `next_checkin_date` is null. The first check-in is the user's today plus 14 days and the weekday is the weekday of today. That is true of every program the wizard creates (Amendment 12: "`next_checkin_date` ... M6 sets it. The wizard leaves it null"), including a new program after an ended one. Otherwise the schedule does not move.

### Recompute

A recompute happens when the program is edited and at the end of setup. It runs `deriveTargets` against the newest snapshot's `mu`, the trend weight on yesterday (the onboarding weight when there are no weigh-ins) and the active program, applies the 6000 cap ("The 6000 cap"), and writes a new targets row effective on the user's today. It makes no snapshot, except the start snapshot of the section above.

### Day-of-week offsets

Index 0 is Monday and 6 is Sunday. They are checked as `programs.dow_offsets_kcal` is (ADR 0003, Amendment 12: length 7, no null element, sum 0).

- `dowCaloriesKcal[i] = calories + offsets[i]`, each rounded to 10. The days are worked out from the week held within 800 to 6000, so the 6000 cap never drops a user's offsets: a week of 6630 with offsets `[-300, 300, 0, 0, 0, 0, 0]` gives Monday 5700 and Tuesday 6000.
- For `lose` only, a day below the floor `max(1200, 0.9 · BMR)` is raised to it, in the same way Amendment 1 raises the week (stepped up by 10 until it is at or above the floor), and the clamp `dow_floor` is recorded. This matches Amendment 1's "the floor applies to the `lose` goal only".
- For every goal, each day is kept within 800 to 6000, the targets range. A day below 800 is stepped up and a day above 6000 is stepped down by 10 until it is within the range, and the clamp `dow_range` is recorded. `dow_floor` and `dow_range` are added to the engine's `Clamp` by KEY-605.
- Macros are weekly, not per day, so they do not change with the offsets.
- `dayTarget(targets, localDate, adjustments?)` returns the day's calories from `dow_calories_kcal`, indexed by the weekday of `localDate`. With no adjustments it is exactly that value. This is the interface point KEY-338 asks for. What `adjustments` hold is that ticket's, and `keylow-engine-v1` does not change.

### Key sets and the 6000 cap

**Key sets.** A snapshot's `measurement` is the measurement object of the measurement section, plus the update fields of the update section (`gain`, `rawStepKcal`, `stepKcal`, `stepClamped`) when the measurement is eligible, and null for `start`. A targets row's `basis` is `{ source: 'start' | 'checkin' | 'recompute', tdeeKcal, trendWeightKg, bmrKcal, goal, ratePctPerWeek, effectiveRatePctPerWeek, proteinGPerKg, fatFraction, dowOffsetsKcal, clamps }`.

- `effectiveRatePctPerWeek` is the true signed value, negative when the floor is above `tdee` (point 3 of `deriveTargets`, Amendment 1).
- `bmrKcal`, which the floor uses, is Mifflin-St Jeor of the profile's stats with `onboarding_weight_kg` and the age on `as_of_date` (on today for a recompute). The golden pairs BMR 1755 with the trend weights 78.65 and 79.02, which is this rule.
- **The 6000 cap.** A check-in or a recompute applies the 6000 cap helper of `@keylow/core/setup` (KEY-599's `capToProfileRange`) after `deriveTargets`, because a `gain` at a high `tdee` can exceed 6000 and the `targets` row and the diary's range stop at 6000. It records `profile_max`. So `clamps` holds the setup layer's clamp list, the engine's `Clamp` plus `profile_max` (Amendment 1, "How the wizard uses it"), and `profile_max` stays out of the engine's `Clamp`. The macros after the cap are re-derived for the capped calories, by calling KEY-598's macro step again with the capped calories, so `4P + 9F + 4C` stays close to the stored calories. KEY-599's `startingPlan` does the same, so the wizard and the first check-in store the same macros for the same capped user.
- Stored macro grams are whole grams, rounded to nearest (protein 126 from 125.84).

### `run-checkin`

`POST`, JSON, idempotent on `(user_id, as_of_date)`. `run-checkin` reads `weigh_ins` with `deleted_at is null`.

**The gateway.** KEY-612, which creates the function, adds `[functions.run-checkin]` to `config.toml` with `verify_jwt = false`, and the `import_map` and `entrypoint` lines, as `off-product` has. The backstop carries no JWT, so the gateway cannot check one. The modes that need a user call `requireUser` from `_shared/auth.ts`.

**The modes.** A body with any other `mode` answers 400 `bad_mode`.

- `{ mode: 'due' }`, the default, with the user's JWT, runs the caller's due check-ins (catch-up, at most 8) and answers 200 `{ ran, nextCheckinDate }`. `ran` counts the check-ins recorded, and does not count a `duplicate`. `nextCheckinDate` is the program's stored date after the run, null when it has none.
- `{ mode: 'recompute' }` with the user's JWT applies the start snapshot, the schedule and the recompute above, and answers 200 `{ targetsId }`.
- `{ mode: 'backstop' }` with the header `x-checkin-secret` runs every due user and answers 200 `{ users, ran, failed }`. `users` counts the users handled, `ran` the check-ins recorded and `failed` the users that failed. One run handles at most the oldest 200 due users, and the hourly cadence drains the rest. A user who fails every hour stays among the oldest, so 200 such users could hold the rest back: unreachable at today's scale, and a later amendment can order failed users last.
- A missing or invalid JWT in `due` or `recompute` answers 401.
- With no active program, `due` and `recompute` answer 409 `no_program`. With missing stats they answer 409 `missing_stats` ("The prior for an account with no stats").

**The backstop credential.** `x-checkin-secret` is compared in constant time with the function secret `CHECKIN_CRON_SECRET`. The mode answers 401 when `CHECKIN_CRON_SECRET` is unset or empty, so it fails closed, and when the header is missing or wrong. The backstop takes no `Authorization` header. A JWT is never the backstop credential, and the secret is never accepted in the other modes.

**After a duplicate.** When the writer answers `duplicate`, `run-checkin` re-reads the newest snapshot and `next_checkin_date` and continues from the stored values, so a second caller does not repeat the step.

**Logs.** It logs user ids, counts, durations and error codes only, never a value of intake, weight or expenditure.

**CI and the hosted gateway.** CI serves the functions with `--no-verify-jwt`, so it cannot prove the gateway lets the backstop through. That is a post-deploy check, for KEY-615 or KEY-625: one hourly run answers 200 and not 401.

### Engine targets and manual targets

By Q5, a user with an active program and a current `targets` row reads the `targets` row. Anyone else reads the profile's manual columns (ADR 0003, Amendment 4). Saving targets by hand on the Targets screen ends the active program (`ended_on` is today), which turns the weekly check-in off: "I'll set my own targets" means exactly that. Running "Estimate my targets" starts or updates a program again. A user who took the wizard's escape has no program and no check-ins.

Ending a program leaves its last targets row with `effective_to` null. That row is in force only while the active program exists, which is the read rule above, so a history reader must not label it current after the program ends (ADR 0003, Amendment 13).

The diary reads the open row only when its `program_id` is the active program's id. A row left open by an ended program is not the new program's row, and a row with no `program_id` is nobody's, so in both cases the diary reads the profile's manual columns until the new program has a row of its own. A manual save ends the program on the later of the user's local today and the program's `started_on`, so the check `ended_on >= started_on` (ADR 0003, Amendment 12) holds even for a user who has moved to an earlier time zone.

### The confidence band

The confidence band the program screen and the chart show is `mu ± 1.2816 · sd`, an 80 % range (Q6), where `sd` is `√var`. It is a display rule and not an engine param.

### The backstop

The backstop runs hourly, at minute 17 of each hour, and not once a day (Q7), so each user's check-in happens in the first hour of their local day wherever they live. Each run touches only the users who are due, up to 200 (see "`run-checkin`"). The pg_cron and pg_net job is ADR 0003, Amendment 13.

### The prior for an account with no stats

Decision: no snapshot is ever made without stats. A snapshot needs an active program, and the only path that creates one, the wizard, writes the stats in the same save. Existing accounts marked set up with null stats, and users who took the escape, have no program, so they get no check-in and keep their manual targets until they run "Estimate my targets". If a program exists while any of `sex`, `birth_date`, `height_cm`, `activity` or `onboarding_weight_kg` is null, which only a row written outside the app can be, `run-checkin` writes nothing and answers 409 `missing_stats` for that user. The backstop counts it as failed and moves on.

### `EngineParams` additions

Amendment 1 added the `expenditure` and `targets` groups with the values `initialExpenditure` and `deriveTargets` use, and said the measurement and update params come with the measurement and update functions. They come now, with the values this ADR already froze under "EngineParams defaults": `windowDays` 28, `minSpanDays` 14, `minWeighDays` 8, `minCompleteDays` 10, `residualSdFloorKg` 0.3, `intakeCvPerDay` 0.15, `incompletePenaltyKcal` 100, `processSdKcalPerWeek` 75 and `maxWeeklyChangeKcal` 250. No value differs, so `keylow-engine-v1` keeps its version, and this is not a retune. The confidence factor, the 6000 cap, the 8 catch-up check-ins, the 200 users and the schedule are not engine params. The names of the keys are KEY-606's and KEY-607's call.

### What this amendment closes

From Amendment 1, "Open": the check-in weekday ("The schedule" and Q1), the day-of-week offsets in `deriveTargets` (above), and the prior for an account with no stats ("The prior for an account with no stats"). The fat floor that can exceed the calories at very high weights is resolved in KEY-598: fat is `floor(calories / 9)` g, protein and carbs are 0 g, and `macro_fit` is recorded.

### Not in v1

- The day-of-week target screen. The engine and the schema support the offsets, and the wizard leaves them at zero.
- Excluding the days after a large target change from the measurement. The params are versioned, so it can land later as a new version.
- Push notifications for a check-in.
- Body fat input (Amendment 1).

### Open

Nothing is open in this amendment.

### Implemented by

- KEY-605: day-of-week offsets in `deriveTargets` and `dayTarget`.
- KEY-606 and KEY-607: `measureExpenditure` and `updateExpenditure`, with the golden chain.
- KEY-608: `checkinStep`, with the shared golden and the ineligible fixtures.
- KEY-609: the schedule, catch-up, the start snapshot and the recompute.
- KEY-610 and KEY-611: the database side, ADR 0003 Amendment 13.
- KEY-612, KEY-613 and KEY-614: `run-checkin` in its three modes, including the `config.toml` entry. KEY-616: the hourly job.
- KEY-615 or KEY-625: the post-deploy gateway check.
- KEY-617: the diary on live targets and the manual save that ends the program.
- KEY-619: the program model (the band and the settling state). KEY-621: the api-client edit and the setup save that make the first snapshot and targets.
- KEY-622: `tools/replay`, which runs the same functions over a fixture.

### Consequences of Amendment 2

Core builds `measureExpenditure`, `updateExpenditure`, the day-of-week rule and the check-in's schedule logic to the numbers above, and the Build Plan's golden chain, with the figures and tolerances in "Golden numbers", turns them into tests. The database and the functions build to ADR 0003, Amendment 13. M6 does not renegotiate any of it. Any further deviation from the frozen Decision, from Amendment 1 or from this amendment needs an Amendment 3 before the code that implements it lands.
