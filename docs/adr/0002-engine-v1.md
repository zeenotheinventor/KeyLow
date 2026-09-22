# 0002: Adaptive engine shape, keylow-engine-v1

## Status

Accepted, 2026-09-22

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
