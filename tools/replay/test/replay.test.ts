import { DEFAULT_ENGINE_PARAMS } from "@keylow/core/engine";
import { describe, expect, it } from "vitest";

import { expectWithin, rowAt } from "./helpers.ts";
import { fixtureInput } from "../src/fixtures.ts";
import { historyToInput } from "../src/historyInput.ts";
import { parseHistory } from "../src/historySchema.ts";
import { applyParamOverrides } from "../src/paramOverrides.ts";
import { replay } from "../src/replay.ts";

/*
 * Every expected figure is a literal. The golden chain and the day 28 targets are the table of ADR 0002,
 * Amendment 2 ("Golden numbers"). The fixtures start on 2026-04-02, so check-ins fall on 16 April, 23 April
 * and 30 April, which are days 14, 21 and 28.
 */

const GOLDEN_ROWS = replay(fixtureInput("golden"), DEFAULT_ENGINE_PARAMS);

describe("replay of the golden fixture", () => {
  it("should run a check-in on day 14, 21 and 28, and none after the last day of data", () => {
    expect(GOLDEN_ROWS.map((row) => row.asOfDate)).toStrictEqual([
      "2026-04-16",
      "2026-04-23",
      "2026-04-30",
    ]);
  });

  it("should reach mu 2559.56 on day 14, from the fixture's prior of 2500", () => {
    expectWithin(rowAt(GOLDEN_ROWS, 0).muKcal, 2559.56, 0.5);
  });

  it("should reach mu 2574.22 on day 21, from the day 14 snapshot", () => {
    expectWithin(rowAt(GOLDEN_ROWS, 1).muKcal, 2574.22, 0.5);
  });

  it("should reach mu 2579.54 on day 28, from the day 21 snapshot", () => {
    expectWithin(rowAt(GOLDEN_ROWS, 2).muKcal, 2579.54, 0.5);
  });

  it("should record the day 14 check-in as eligible, with a step of 59.56 that was not clamped", () => {
    const first = rowAt(GOLDEN_ROWS, 0);

    expect(first.eligible).toBe(true);
    expect(first.reasons).toStrictEqual([]);
    expectWithin(first.stepKcal ?? Number.NaN, 59.56, 0.5);
    expect(first.stepClamped).toBe(false);
    expect(first.gain).toBeGreaterThan(0);
    expect(first.gain).toBeLessThan(1);
  });

  it("should give the 80 percent band of day 14, rounded to 10 either side of mu", () => {
    const first = rowAt(GOLDEN_ROWS, 0);

    expect(first.bandLowKcal).toBe(2290);
    expect(first.bandHighKcal).toBe(2830);
  });

  it("should give the day 28 targets of 2140 kcal, P 126, F 73 and C 245", () => {
    const last = rowAt(GOLDEN_ROWS, 2);

    expect(last.caloriesKcal).toBe(2140);
    expect(last.proteinG).toBe(126);
    expect(last.fatG).toBe(73);
    expect(last.carbsG).toBe(245);
  });

  it("should record no clamp on the day 28 targets, and a trend weight under the first weigh-in", () => {
    const last = rowAt(GOLDEN_ROWS, 2);

    expect(last.clamps).toStrictEqual([]);
    expect(last.trendWeightKg).toBeLessThan(80);
    expect(last.trendWeightKg).toBeGreaterThan(78.65);
  });
});

describe("replay of the ineligible fixture", () => {
  const rows = replay(fixtureInput("ineligible"), DEFAULT_ENGINE_PARAMS);

  it("should mark day 14 ineligible on complete_days alone", () => {
    const first = rowAt(rows, 0);

    expect(first.asOfDate).toBe("2026-04-16");
    expect(first.eligible).toBe(false);
    expect(first.reasons).toStrictEqual(["complete_days"]);
  });

  it("should keep mu at the prior of 2500 and give no gain and no step on an ineligible day", () => {
    const first = rowAt(rows, 0);

    expect(first.muKcal).toBe(2500);
    expect(first.gain).toBeNull();
    expect(first.stepKcal).toBeNull();
    expect(first.stepClamped).toBeNull();
  });

  it("should widen the band by the process noise when nothing was measured", () => {
    const first = rowAt(rows, 0);

    expect(first.bandLowKcal).toBe(2010);
    expect(first.bandHighKcal).toBe(2990);
  });
});

describe("replay with parameters overridden", () => {
  it("should apply a weekly clamp of 10 kcal, so day 14 moves from 2500 to 2510 and is marked clamped", () => {
    const { params } = applyParamOverrides(DEFAULT_ENGINE_PARAMS, [
      "expenditure.maxWeeklyChangeKcal=10",
    ]);

    const first = rowAt(replay(fixtureInput("golden"), params), 0);

    expect(first.muKcal).toBe(2510);
    expect(first.stepKcal).toBe(10);
    expect(first.stepClamped).toBe(true);
  });
});

/** The golden fixture's weigh-ins as a history file, with no days logged and stats of a 36 year old. */
function historyText(startedOn = "2026-04-02"): string {
  const weighIns = Array.from({ length: 28 }, (_, day) => ({
    localDate: `2026-04-${String(day + 2).padStart(2, "0")}`,
    weightKg: 80 - 0.05 * day,
  }));
  return JSON.stringify({
    stats: { sex: "male", birthDate: "1990-01-01", heightCm: 180, activity: "moderate" },
    onboardingWeightKg: 80,
    program: {
      goal: "lose",
      ratePctPerWeek: 0.5,
      proteinGPerKg: 1.6,
      fatFraction: 0.4,
      dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
      startedOn,
    },
    weighIns,
    days: [],
  });
}

describe("replay of a history file", () => {
  const input = historyToInput(parseHistory(historyText()));
  const rows = replay(input, DEFAULT_ENGINE_PARAMS);

  it("should run the check-ins 14, 21 and 28 days after startedOn, up to the day after the last data", () => {
    expect(rows.map((row) => row.asOfDate)).toStrictEqual([
      "2026-04-16",
      "2026-04-23",
      "2026-04-30",
    ]);
  });

  it("should start from the start snapshot: BMR 1750 times 1.55 is 2712.5 for a 36 year old, 180 cm, 80 kg man", () => {
    // 10 * 80 + 6.25 * 180 - 5 * 36 + 5 = 1750, and a moderate activity level is 1.55.
    expect(rowAt(rows, 0).muKcal).toBe(2712.5);
  });

  it("should be ineligible with no days logged, so mu stays at the start snapshot's", () => {
    expect(rows.every((row) => !row.eligible && row.reasons.includes("complete_days"))).toBe(true);
    expect(rows.every((row) => row.muKcal === 2712.5)).toBe(true);
  });

  it("should use the trend weight of the weigh-ins for the targets", () => {
    expect(rowAt(rows, 0).trendWeightKg).toBeLessThan(80);
  });

  it("should use the start snapshot's params, so a different sex offset moves the starting mu", () => {
    const { params } = applyParamOverrides(DEFAULT_ENGINE_PARAMS, [
      "expenditure.sexOffsetKcal.male=-161",
    ]);

    // (1750 - 166) * 1.55 = 2455.2
    expectWithin(rowAt(replay(input, params), 0).muKcal, 2455.2, 1e-9);
  });

  it("should print no rows when no check-in is due yet", () => {
    const early = historyToInput(parseHistory(historyText("2026-04-20")));

    expect(replay(early, DEFAULT_ENGINE_PARAMS)).toStrictEqual([]);
  });
});
