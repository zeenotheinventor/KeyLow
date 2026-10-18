# @keylow/core

Pure domain logic shared by every Keylow app: zod schemas, nutrient maths, unit conversion, number formatting, user-facing copy, search presentation helpers, the engine and date helpers. It is consumed as TypeScript source, so there is no build step.

## Purity rules

Core runs in React Native and Deno, and the engine must stay reproducible (ADR 0002). So code in `src/`:

- has no platform dependencies: no React, React Native, Expo, Next.js or Supabase
- uses no Node built-ins, in either `node:` or bare form
- does no IO
- never calls `Date.now()` or `new Date()` without an argument
- uses no randomness

Dates are `YYYY-MM-DD` strings in the user's time zone, and time zones are always passed in, never defaulted.

ESLint enforces the dependency rules for `src/` (`import-x/no-nodejs-modules` and `no-restricted-imports`). `tsconfig.src.json` type-checks `src/` alone with `"types": []`, so Node globals and modules do not resolve there. (The main `tsconfig.json` also covers the tests and `vitest.config.ts`, and Vitest pulls the Node types into that program.) The clock and randomness rules are by convention.

## Layout

| Path             | Holds                                                                                                        | Status                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `src/dates/`     | Date helpers (`toLocalDate`)                                                                                 | One helper                                                               |
| `src/schemas/`   | Zod schemas (nutrients, foods, Edge Function contracts)                                                      | Foods and OFF contracts                                                  |
| `src/foods/`     | Barcode normalisation, quality rule, data attribution                                                        | Added in M2                                                              |
| `src/format/`    | Number formatting: calories, grams, weight, delta grams, energy share                                        | Ported from the design                                                   |
| `src/copy/`      | Every shared user-facing sentence: sources, search, barcode, auth, forms                                     | Added in M2                                                              |
| `src/search/`    | Search presentation: grouping, match highlight, energy shares, macros, food rows                             | Added in M2                                                              |
| `src/terms/`     | Whether the user has to accept the Terms (again): `needsTermsAcceptance`                                     | Added in M2                                                              |
| `src/nutrition/` | Nutrient maths and unit conversion                                                                           | Empty, filled in M2 and M5                                               |
| `src/engine/`    | Trend, expenditure and targets                                                                               | Empty, filled in M6                                                      |
| `src/training/`  | Muscle list, training bounds and enums, set snapshot, `TrainingParams`, heat model, projected against actual | Added in T1 (KEY-346), heat model and plan week in T3 (KEY-351, KEY-352) |
| `test/`          | Vitest tests, mirroring the `src/` folder structure                                                          |                                                                          |

Each folder is a subpath export (`@keylow/core/dates`, `@keylow/core/foods`, `@keylow/core/schemas`, `@keylow/core/nutrition`, `@keylow/core/engine`, `@keylow/core/format`, `@keylow/core/copy`, `@keylow/core/search`, `@keylow/core/terms`, `@keylow/core/training`), and `@keylow/core` re-exports the public surface. The exception is `@keylow/core/testing` (`buildFood`, `buildFoodPortion`, `buildOffCandidate`): test builders that only test code imports, never shipped code, and the root export leaves it out.

## Formatting, copy and search presentation

No screen formats a number, words an error, groups search results or highlights a match itself. The apps call these instead.

- `format` ports the design system's `Format` (`design-source/components/core/kl.js`): `formatCalories` (`2,480`), `formatGrams` (`7.5`, `142`), `formatWeight` (`82.4 kg`), `formatDeltaGrams` (true minus sign) and `formatEnergyShare` (`32 %`). The thousands separator is written by hand, because Hermes and Node must agree to the character, so nothing here calls `toLocaleString`. `test/format/designFormat.ts` holds the design's own `Format` as a fixture, and the parity test runs the port against it over a table and a property range. The one deliberate difference: a calorie value that rounds to a negative zero reads `0`, where the design prints `-0`. If `kl.js` changes, copy the new arithmetic into the fixture and the tests show the drift.
- `copy` holds the sentences. A nutrient that is not given is `not given`, never `0`. `describeEdgeError` and `describeAuthError` give a fixed sentence per code and a generic one for anything else, and never show the raw code or the server message. `test/copy/voice.test.ts` sweeps every exported sentence for exclamation marks, em dashes, semicolons, and `my` or `we`, and fails when a function is exported without a sample call there.
- `search` is presentation only, with no new data. `groupFoodSearchResults` is a client-side slice of the rows the RPC returned (25 by default, 50 at most), so its hidden count never covers matches beyond that. `highlightMatch` is best effort and does not claim to mirror the ranking in `search_foods`. `energyShares` is Atwater 4/4/9 over the stated energy, so the shares may not sum to 100. `describeFoodRow` is what a food row shows for a food or an Open Food Facts candidate (name segments, brand, energy, macros, basis, or the "Energy not given" note) as plain text, and `filterOwnFoods` is the client-side name or brand match for Your foods. Each app hands the result to its own row component.

## Training: projected against actual

ADR 0005, "Projected against actual". Three pure functions in `src/training/` turn the active routine and one calendar week of logged sets into the two views the body map shows. None reads the clock: the week and its zone are arguments.

- `expandPlan(routine, weekStart, tz, params)` places each routine day with a weekday on that day of the week that starts on `weekStart` (a Monday, `YYYY-MM-DD`) in the IANA zone `tz`, at `params.plannedTime` local (18:00 in v1), and expands each routine exercise into `target_sets` working sets at `target_rir`. The `PlannedSet`s it returns have the logged set shape, marked `planned: true`, so `muscleState` and `weeklyVolume` run on them unchanged. A day whose weekday is null ("any day") is never placed.
- `projectWeek(routine, weekStart, tz, logged, params)` merges the week's logged sessions into the plan and returns `{ planned, actual, projected }`. A session of a routine day replaces that day's planned sets with its logged ones, whichever day it was logged on, so extra sets on a logged day count as on plan. A planned day with no session stays in the projection, so a missed day shows as a gap. A session with no day of this routine (none, or a day of another routine) counts in `actual` only. A session of an any-day (null weekday) routine day counts in both views, though the day itself is never placed. `projectedState(projected, at, params)` is `muscleState` over the projection, for projected heat at a moment.
- `compareWeek(actual, projected, params)` returns, for every muscle id, the actual and projected effort-weighted weekly sets, the gap (actual minus projected) and `behind`, `on_plan` or `ahead`, on plan within `params.onPlanToleranceSets` (1 set in v1, the tolerance itself included).

`params` here is a `CompareParams` (`COMPARE_PARAMS_V1`): the planned time and tolerance, with the `TrainingParams` they were tuned with. It sits beside `TrainingParams` rather than inside it so that the pinned v1 object is never edited in place (ADR 0002), and both carry the same version.

## Scripts

```sh
pnpm --filter @keylow/core lint
pnpm --filter @keylow/core typecheck
pnpm --filter @keylow/core test
```

Formatting is checked once at the repository root with `pnpm format:check`.
