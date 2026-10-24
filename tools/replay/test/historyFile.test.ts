import { describe, expect, it } from "vitest";

import { aprilDays, expectWithin, historyObject, rowAt } from "./helpers.ts";
import { runReplay } from "../src/cli.ts";
import { ReplayInputError } from "../src/replayInputError.ts";
import { replayRowsSchema } from "../src/replayRow.ts";

import type { ReplayRow } from "../src/replayRow.ts";

/*
 * The history file's wiring, pinned with literals. The man is born on 1990-04-20 and is 180 cm tall, moderate
 * activity, 80 kg at set up, and the schedule is set on 2026-04-02. Mifflin-St Jeor is 10 * 80 + 6.25 * 180
 * - 5 * age + 5: 1755 at 35 years (every day before his birthday on 2026-04-20) and 1750 at 36.
 *
 * A target that the floor sets shows the BMR the check-in used. The floor is the BMR itself with
 * floorBmrFactor 1, and a 5 % a week loss with maxLossPct 5 and maxDeficitFrac 0.99 is far below it.
 * A floored target is rounded up to 10, so 1755 is 1760 and 1750 is 1750. He turns 36 on 2026-04-20, so the
 * check-in of 2026-04-16 has age 35 and those of 2026-04-23 and 2026-04-30 have age 36.
 */

const FLOOR_AT_THE_BMR = [
  "--param",
  "targets.floorBmrFactor=1",
  "--param",
  "targets.maxLossPct=5",
  "--param",
  "targets.maxDeficitFrac=0.99",
];

function rowsOf(history: unknown, extraArguments: string[] = []): ReplayRow[] {
  const { stdout } = runReplay(["--file", "history.json", "--json", ...extraArguments], () =>
    JSON.stringify(history),
  );
  return replayRowsSchema.parse(JSON.parse(stdout));
}

/** Weigh-ins of 80 kg falling 0.05 kg a day from 2026-04-02, `count` days. */
const weighInsFor = (count: number) =>
  aprilDays(2, count, (localDate, index) => ({ localDate, weightKg: 80 - 0.05 * index }));

const completeDays = (firstDay: number, count: number) =>
  aprilDays(firstDay, count, (localDate) => ({ localDate, kcal: 2200, isComplete: true }));

describe("a history file's BMR", () => {
  const history = historyObject({
    program: { ratePctPerWeek: 5 },
    weighIns: weighInsFor(28),
    days: completeDays(2, 28),
  });

  it("should be worked out on each check-in's own day: 1755 on 2026-04-16 and 1750 on 2026-04-30", () => {
    const rows = rowsOf(history, FLOOR_AT_THE_BMR);

    expect(rows.map((row) => row.asOfDate)).toStrictEqual([
      "2026-04-16",
      "2026-04-23",
      "2026-04-30",
    ]);
    expect(rowAt(rows, 0).caloriesKcal).toBe(1760);
    expect(rowAt(rows, 2).caloriesKcal).toBe(1750);
    expect(rowAt(rows, 0).clamps).toContain("floor");
  });

  it("should take the sex offset of an override: with -9 for a man, 1741 is 1750 and 1736 is 1740", () => {
    const rows = rowsOf(history, [
      ...FLOOR_AT_THE_BMR,
      "--param",
      "expenditure.sexOffsetKcal.male=-9",
    ]);

    expect(rowAt(rows, 0).caloriesKcal).toBe(1750);
    expect(rowAt(rows, 2).caloriesKcal).toBe(1740);
  });
});

describe("a history file's start snapshot", () => {
  it("should be as of startedOn and not the first weigh-in: age 35 gives 1755 * 1.55 is 2720.25", () => {
    // The first weigh-in is on 2026-04-25, after his birthday. A start as of that day would use 1750 * 1.55.
    const history = historyObject({
      weighIns: aprilDays(25, 5, (localDate) => ({ localDate, weightKg: 80 })),
    });

    expectWithin(rowAt(rowsOf(history), 0).muKcal, 2720.25, 1e-9);
  });
});

describe("a history file with no weigh-ins", () => {
  const rows = rowsOf(historyObject({ days: completeDays(2, 28) }));

  it("should run the check-ins from the days alone", () => {
    expect(rows.map((row) => row.asOfDate)).toStrictEqual([
      "2026-04-16",
      "2026-04-23",
      "2026-04-30",
    ]);
  });

  it("should be ineligible on span and weigh_days alone, because its days are complete", () => {
    expect(rows.every((row) => !row.eligible)).toBe(true);
    expect(rowAt(rows, 0).reasons).toStrictEqual(["span", "weigh_days"]);
    expect(rowAt(rows, 2).reasons).toStrictEqual(["span", "weigh_days"]);
  });

  it("should have no trend weight, and the onboarding weight of 80 kg stands in: protein is 1.6 * 80 is 128", () => {
    expect(rows.every((row) => row.trendWeightKg === null)).toBe(true);
    expect(rowAt(rows, 0).proteinG).toBe(128);
  });

  it("should keep mu at the start snapshot's 2720.25 for a man who is 35 on the day the schedule is set", () => {
    expectWithin(rowAt(rows, 0).muKcal, 2720.25, 1e-9);
  });
});

describe("a history file whose days run past the last weigh-in", () => {
  it("should schedule check-ins up to the day after the last day of either: days to 2026-04-29 give 3 rows", () => {
    const rows = rowsOf(historyObject({ weighIns: weighInsFor(9), days: completeDays(2, 28) }));

    expect(rows.map((row) => row.asOfDate)).toStrictEqual([
      "2026-04-16",
      "2026-04-23",
      "2026-04-30",
    ]);
  });

  it("should schedule up to the day after the last weigh-in when the weigh-ins run past the days", () => {
    const rows = rowsOf(historyObject({ weighIns: weighInsFor(28), days: completeDays(2, 9) }));

    expect(rows.map((row) => row.asOfDate)).toStrictEqual([
      "2026-04-16",
      "2026-04-23",
      "2026-04-30",
    ]);
  });
});

describe("a --param that breaks a floor of the params", () => {
  // Without a complete day the window has no mean intake, so minCompleteDays of 0 gives a value that is not a number.
  const history = historyObject({ weighIns: weighInsFor(28) });
  const breaking = ["--param", "expenditure.minCompleteDays=0"];

  it("should stop with the date of the first bad row and no value, so --json never prints NaN", () => {
    expect(() =>
      runReplay(["--file", "history.json", "--json", ...breaking], () => JSON.stringify(history)),
    ).toThrow(
      new ReplayInputError(
        "The engine gave a value that is not a number on 2026-04-16. Check the --param values.",
      ),
    );
  });

  it("should stop the table the same way", () => {
    expect(() =>
      runReplay(["--file", "history.json", ...breaking], () => JSON.stringify(history)),
    ).toThrow("on 2026-04-16. Check the --param values.");
  });

  it("should leave the same history alone with the default params", () => {
    expect(rowsOf(history)).toHaveLength(3);
  });
});
