import { describe, expect, it } from "vitest";

import { addCalendarDays } from "../../src/dates";
import {
  checkinStep,
  DEFAULT_ENGINE_PARAMS,
  recomputeTargets,
  toDayInputs,
} from "../../src/engine";
import { targetsBasisSchema } from "../../src/schemas";
import { goldenCheckinFixture } from "../../src/testing";

import type { CheckinProgram, EngineParams, RecomputeInput } from "../../src/engine";

/*
 * Every expected figure is a literal. The day-28 figures are those of ADR 0002, Amendment 2, "Golden
 * numbers": mu 2579.54, the trend weight 79.0227 kg and BMR 1755 give 2140 kcal, P 126, F 73, C 245. The
 * other cases were worked out by hand from the Build Plan's rules.
 */

const LOSE_HALF_A_PERCENT: CheckinProgram = {
  goal: "lose",
  ratePctPerWeek: 0.5,
  proteinGPerKg: 1.6,
  fatFraction: 0.4,
  dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
};

const DAY_28: RecomputeInput = {
  snapshot: { kind: "checkin", mu_kcal: 2579.54 },
  trendWeightKg: 79.0227,
  program: LOSE_HALF_A_PERCENT,
  bmrKcal: 1755,
  today: "2026-04-30",
};

describe("recomputeTargets on the day 28 golden snapshot", () => {
  it("should give 2140 kcal, P 126, F 73, C 245 for lose 0.5 % a week", () => {
    const targets = recomputeTargets(DAY_28);

    expect([
      targets.calories_kcal,
      targets.protein_g,
      targets.fat_g,
      targets.carbs_g,
    ]).toStrictEqual([2140, 126, 73, 245]);
  });

  it("should give the same targets as checkinStep's day 28 for the same trend weight", () => {
    const day0 = "2026-04-02";
    const fixture = goldenCheckinFixture(day0);
    const days = toDayInputs(fixture.dayTotals, fixture.dayLogs);
    const input = (daysAfterDayZero: number, prior = fixture.prior) => ({
      asOfDate: addCalendarDays(day0, daysAfterDayZero),
      prior,
      weighIns: fixture.weighIns,
      days,
      program: fixture.program,
      bmrKcal: fixture.bmrKcal,
    });
    const belief = ({ snapshot }: ReturnType<typeof checkinStep>) => ({
      muKcal: snapshot.mu_kcal,
      varKcal2: snapshot.var_kcal2,
    });
    const first = checkinStep(input(14));
    const second = checkinStep(input(21, belief(first)));
    const third = checkinStep(input(28, belief(second)));

    const recomputed = recomputeTargets({
      snapshot: { kind: "checkin", mu_kcal: third.snapshot.mu_kcal },
      trendWeightKg: third.targets.basis.trendWeightKg,
      program: fixture.program,
      bmrKcal: fixture.bmrKcal,
      today: third.targets.effective_from,
    });

    expect(recomputed).toStrictEqual({
      ...third.targets,
      basis: { ...third.targets.basis, source: "recompute" },
    });
  });

  it("should give 2580 kcal when the goal is changed to maintain", () => {
    const targets = recomputeTargets({
      ...DAY_28,
      program: { ...LOSE_HALF_A_PERCENT, goal: "maintain" },
    });

    expect(targets.calories_kcal).toBe(2580);
  });

  it("should read the mean from the snapshot it is given (mu 2400 gives 1970 kcal, P 126, F 65, C 220)", () => {
    const targets = recomputeTargets({ ...DAY_28, snapshot: { kind: "checkin", mu_kcal: 2400 } });

    expect([
      targets.calories_kcal,
      targets.protein_g,
      targets.fat_g,
      targets.carbs_g,
    ]).toStrictEqual([1970, 126, 65, 220]);
    expect(targets.basis.tdeeKcal).toBe(2400);
  });

  it("should add the weekday offsets to the week's calories", () => {
    const targets = recomputeTargets({
      ...DAY_28,
      program: { ...LOSE_HALF_A_PERCENT, dowOffsetsKcal: [-300, 300, 0, 0, 0, 0, 0] },
    });

    expect(targets.dow_calories_kcal).toStrictEqual([1840, 2440, 2140, 2140, 2140, 2140, 2140]);
  });
});

describe("recomputeTargets reads the params it is given", () => {
  const customParams: EngineParams = {
    ...DEFAULT_ENGINE_PARAMS,
    // The version is typed as the one literal, so a different one is a deliberate type error here.
    // @ts-expect-error a runtime check that the version is read from the params it is given
    version: "keylow-engine-test",
    targets: { ...DEFAULT_ENGINE_PARAMS.targets, roundToKcal: 50 },
  };

  it("should round to the params' step: 50 kcal gives 2150 kcal, P 126, F 73, C 247, not 2140", () => {
    const targets = recomputeTargets(DAY_28, customParams);

    expect([
      targets.calories_kcal,
      targets.protein_g,
      targets.fat_g,
      targets.carbs_g,
    ]).toStrictEqual([2150, 126, 73, 247]);
    expect(targets.params).toStrictEqual(customParams);
  });

  it("should take the engine version from the params", () => {
    expect(recomputeTargets(DAY_28, customParams).engine_version).toBe("keylow-engine-test");
  });
});

describe("recomputeTargets rows", () => {
  it("should make the targets effective from the day it is run", () => {
    expect(recomputeTargets({ ...DAY_28, today: "2026-05-02" }).effective_from).toBe("2026-05-02");
  });

  it("should record source recompute after a check-in snapshot", () => {
    expect(recomputeTargets(DAY_28).basis.source).toBe("recompute");
  });

  it("should record source start after a start snapshot", () => {
    const targets = recomputeTargets({ ...DAY_28, snapshot: { kind: "start", mu_kcal: 2413.125 } });

    expect(targets.basis.source).toBe("start");
  });

  it("should record the basis from the program, the snapshot and the weight it was given", () => {
    expect(recomputeTargets(DAY_28).basis).toMatchObject({
      tdeeKcal: 2579.54,
      trendWeightKg: 79.0227,
      bmrKcal: 1755,
      goal: "lose",
      ratePctPerWeek: 0.5,
      proteinGPerKg: 1.6,
      fatFraction: 0.4,
      dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
      clamps: [],
    });
  });

  it("should carry the engine version and the whole default params", () => {
    const targets = recomputeTargets(DAY_28);

    expect(targets.engine_version).toBe("keylow-engine-v1");
    expect(targets.params).toStrictEqual(DEFAULT_ENGINE_PARAMS);
  });

  it("should name exactly the targets columns of ADR 0002, Amendment 2", () => {
    expect(Object.keys(recomputeTargets(DAY_28)).sort()).toStrictEqual([
      "basis",
      "calories_kcal",
      "carbs_g",
      "dow_calories_kcal",
      "effective_from",
      "engine_version",
      "fat_g",
      "params",
      "protein_g",
    ]);
  });

  it.each(["start", "checkin"] as const)(
    "should write a basis that the KEY-620 schema accepts after a %s snapshot",
    (kind) => {
      const { basis } = recomputeTargets({ ...DAY_28, snapshot: { kind, mu_kcal: 2579.54 } });

      expect(targetsBasisSchema.safeParse(basis).success).toBe(true);
    },
  );
});

describe("recomputeTargets and the 6000 cap", () => {
  /*
   * mu 5900 and a gain of 0.5 % of 100 kg a week. One percent of 100 kg a week is 100 * 7700 / 7 / 100 =
   * 1100 kcal a day, so 550 on top makes 6450, cut to 6000. The macros are split again for 6000: protein
   * 160 g, 5360 kcal after it, fat round(0.4 * 5360 / 9) = 238 g and carbs round((5360 - 9 * 238) / 4) =
   * round(804.5) = 805 g. The effective rate is (6000 - 5900) / 1100.
   */
  const gainAtTheTop = recomputeTargets({
    snapshot: { kind: "checkin", mu_kcal: 5900 },
    trendWeightKg: 100,
    program: {
      goal: "gain",
      ratePctPerWeek: 0.5,
      proteinGPerKg: 1.6,
      fatFraction: 0.4,
      dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
    },
    bmrKcal: 1755,
    today: "2026-04-30",
  });

  it("should cut the calories to 6000, split the macros again and record profile_max", () => {
    expect([
      gainAtTheTop.calories_kcal,
      gainAtTheTop.protein_g,
      gainAtTheTop.fat_g,
      gainAtTheTop.carbs_g,
    ]).toStrictEqual([6000, 160, 238, 805]);
    expect(gainAtTheTop.basis.clamps).toStrictEqual(["profile_max"]);
  });

  it("should restate the effective rate for the capped calories", () => {
    expect(gainAtTheTop.basis.effectiveRatePctPerWeek).toBeCloseTo(0.0909091, 6);
  });

  it("should write a basis that the KEY-620 schema accepts", () => {
    expect(targetsBasisSchema.safeParse(gainAtTheTop.basis).success).toBe(true);
  });
});
