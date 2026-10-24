# @keylow/replay

Runs the adaptive engine week by week over a fixture or a history file and prints one row for each check-in, for tuning the engine's parameters. It reads one file at most. It has no database client and no network code, so it cannot reach production (a test checks that `package.json` has no Supabase dependency). Fixtures are synthetic.

```sh
pnpm --filter @keylow/replay replay -- --fixture golden
pnpm --filter @keylow/replay replay -- --fixture ineligible
pnpm --filter @keylow/replay replay -- --file history.json
pnpm --filter @keylow/replay replay -- --fixture golden --json
pnpm --filter @keylow/replay replay -- --fixture golden --param expenditure.processSdKcalPerWeek=60
```

## What it runs

- `--fixture golden` and `--fixture ineligible` are `goldenCheckinFixture` and `ineligibleCheckinFixture` from `@keylow/core/testing`, starting on 2026-04-02. `six-complete-days` is another name for `ineligible` (the plan's name for it, though under the answer to Q8 of ADR 0002, Amendment 2 its day 14 window has 9 complete days, not 6). A fixture holds its prior and BMR as numbers, so its start is not worked out from stats.
- `--file <path>` reads a history file (below). Its start is `startSnapshot` for the stats at the onboarding weight as of `startedOn`, and each check-in's BMR is `profileBmr` on its own day.
- The first check-in is `firstCheckinDate(startedOn)`, 14 days after `startedOn`, then every 7 days (`dueCheckinDates`). Each check-in is `checkinStep` fed the belief the last one left. A check-in reads only the days before its date, so the last one runs on the day after the last weigh-in or day in the data. Day 28 of the golden fixture is the check-in that reads day 27. When no check-in falls in that range the tool says so.
- `--json` prints the rows as a JSON array on stdout instead of the header and table. When `--param` is given too, the two header lines go to stderr, so stdout still parses as JSON and the override is not lost.
- `--param path=value` overrides one number of `EngineParams`, for example `--param expenditure.processSdKcalPerWeek=60`, and can be given more than once. The path must exist and name a number, or the tool stops. The header then reads `Params: not keylow-engine-v1 (expenditure.processSdKcalPerWeek=60)`, because the version string stays the same while the numbers do not. If a value breaks one of the floors `params.ts` documents (for example `minCompleteDays` of 0 with no complete day gives NaN), the tool stops with the date of the first bad row, because NaN has no JSON form. Beyond that nothing checks that the result is a sensible engine. The start-related params (`priorCv`, `sexOffsetKcal` and `activityFactors`) only affect `--file` runs, because a fixture holds its prior and BMR as numbers.

## The table

| Column     | Meaning                                                                             |
| ---------- | ----------------------------------------------------------------------------------- |
| `Date`     | The check-in day.                                                                   |
| `Check-in` | `eligible`, or `ineligible (reasons)` with `span`, `weigh_days` or `complete_days`. |
| `mu`       | The expenditure estimate after the check-in, kilocalories a day.                    |
| `80% band` | The likely range of the estimate, each end rounded to 10.                           |
| `K`        | The gain of the update. `-` when the window could not be measured.                  |
| `Step`     | How far the estimate moved, and `clamped` when the weekly clamp limited it.         |
| `Trend kg` | The trend weight the targets used. `-` when the onboarding weight stood in.         |
| `kcal`     | The calorie target. `P g`, `F g` and `C g` are the macro targets.                   |
| `Clamps`   | The guardrails that changed the target, or `-`.                                     |

## The history file

A JSON file, checked with zod. M7's export will write this shape for these tables. Until then a file is written by hand or from the seed. A problem names the field (for example `weighIns[3].localDate`) and what is wrong with it, and never quotes the value.

```json
{
  "stats": { "sex": "male", "birthDate": "1990-01-01", "heightCm": 180, "activity": "moderate" },
  "onboardingWeightKg": 80,
  "program": {
    "goal": "lose",
    "ratePctPerWeek": 0.5,
    "proteinGPerKg": 1.6,
    "fatFraction": 0.4,
    "dowOffsetsKcal": [0, 0, 0, 0, 0, 0, 0],
    "startedOn": "2026-04-02"
  },
  "weighIns": [{ "localDate": "2026-04-02", "weightKg": 80 }],
  "days": [{ "localDate": "2026-04-02", "kcal": 2200, "isComplete": true }]
}
```

- `sex` is `female`, `male` or `other`. `activity` is `sedentary`, `light`, `moderate`, `very` or `extra`. `goal` is `lose`, `maintain` or `gain`.
- `dowOffsetsKcal` is seven whole numbers, Monday first. Dates are `YYYY-MM-DD`, in the user's local calendar.
- A weigh-in is a live one (the export drops soft-deleted rows). A day is a `day_totals` row joined to its `day_logs` row: `isComplete` is the log's flag.

## A sample that produces rows

`sample-history.json` in this folder is a 28 day history (a weigh-in every second day, every day logged and complete). Run it from the repository root:

```sh
pnpm --filter @keylow/replay replay -- --file sample-history.json
```

```
Replay of sample-history.json
Params: keylow-engine-v1

Date        Check-in                       mu       80% band   K      Step   Trend kg  kcal  P g  F g  C g  Clamps
2026-04-16  ineligible (span, weigh_days)  2712.50  2180-3240  -      -      79.63     2270  127  78   265  -
2026-04-23  eligible                       2613.95  2360-2870  0.773  -98.5  79.32     2180  127  74   252  -
2026-04-30  eligible                       2598.06  2410-2780  0.549  -15.9  79.07     2160  127  73   249  -
```

The first check-in is ineligible because only 7 days before it hold a weigh-in, over a span of 13 days, and the engine needs 8 and 14. Its `mu` stays at the start snapshot's 2712.50.

## Checks

```sh
pnpm --filter @keylow/replay test
pnpm --filter @keylow/replay typecheck
pnpm --filter @keylow/replay lint
```

`src/run.ts` registers a small module hook, because `@keylow/core` is read as source with extensionless imports that plain Node does not resolve (`tools/body-model` does the same).
