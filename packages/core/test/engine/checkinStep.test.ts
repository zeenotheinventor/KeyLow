import { describe, expect, it } from "vitest";

import { addCalendarDays } from "../../src/dates";
import { checkinStep, DEFAULT_ENGINE_PARAMS, deriveTargets, toDayInputs } from "../../src/engine";
import { expenditureMeasurementSchema, targetsBasisSchema } from "../../src/schemas";
import { goldenCheckinFixture, ineligibleCheckinFixture } from "../../src/testing";

import type { CheckinInput, CheckinProgram, CheckinResult, EngineParams } from "../../src/engine";
import type { CheckinFixture } from "../../src/testing";

/*
 * Every expected figure below is a literal. The golden chain is the table of ADR 0002, Amendment 2, and the
 * day-28 targets are the figures of "Golden numbers" there. The figures for the other cases come from a
 * separate script that applies the ADR's formulas by hand (nothing imported from the module under test).
 */

const DAY_ZERO = "2026-04-02";

function expectWithin(actual: number, expected: number, tolerance: number): void {
  expect(actual).toBeGreaterThanOrEqual(expected - tolerance);
  expect(actual).toBeLessThanOrEqual(expected + tolerance);
}

/** The check-in `daysAfterDayZero` days after day 0, from the rows the fixture holds. */
function inputAt(
  fixture: CheckinFixture,
  daysAfterDayZero: number,
  prior = fixture.prior,
): CheckinInput {
  return {
    asOfDate: addCalendarDays(DAY_ZERO, daysAfterDayZero),
    prior,
    weighIns: fixture.weighIns,
    days: toDayInputs(fixture.dayTotals, fixture.dayLogs),
    program: fixture.program,
    bmrKcal: fixture.bmrKcal,
  };
}

function beliefOf({ snapshot }: CheckinResult): { muKcal: number; varKcal2: number } {
  return { muKcal: snapshot.mu_kcal, varKcal2: snapshot.var_kcal2 };
}

const GOLDEN = goldenCheckinFixture(DAY_ZERO);

function goldenChain(): [CheckinResult, CheckinResult, CheckinResult] {
  const first = checkinStep(inputAt(GOLDEN, 14));
  const second = checkinStep(inputAt(GOLDEN, 21, beliefOf(first)));
  const third = checkinStep(inputAt(GOLDEN, 28, beliefOf(second)));
  return [first, second, third];
}

describe("checkinStep golden chain (ADR 0002, Amendment 2)", () => {
  it("should reach mu 2559.56 and var 43771.7 at day 14, from the prior 2500 / 140625", () => {
    const [first] = goldenChain();

    expectWithin(first.snapshot.mu_kcal, 2559.56, 0.5);
    expectWithin(first.snapshot.var_kcal2, 43771.7, 0.5);
  });

  it("should reach mu 2574.22 and var 20939.4 at day 21, from the day 14 snapshot", () => {
    const [, second] = goldenChain();

    expectWithin(second.snapshot.mu_kcal, 2574.22, 0.5);
    expectWithin(second.snapshot.var_kcal2, 20939.4, 0.5);
  });

  it("should reach mu 2579.54 and var 13449.0 at day 28, from the day 21 snapshot", () => {
    const [, , third] = goldenChain();

    expectWithin(third.snapshot.mu_kcal, 2579.54, 0.5);
    expectWithin(third.snapshot.var_kcal2, 13449.0, 0.5);
  });

  it("should record the day 14 measurement with its update fields", () => {
    const [first] = goldenChain();
    const { measurement } = first.snapshot;
    if (!measurement.eligible) throw new Error("expected an eligible measurement");

    expect([measurement.spanDays, measurement.weighDays, measurement.completeDays]).toStrictEqual([
      14, 14, 14,
    ]);
    expectWithin(measurement.zKcal, 2585, 0.01);
    expectWithin(measurement.rKcal2, 62467.9, 0.5);
    expectWithin(measurement.gain, 0.70071, 1e-5);
    expectWithin(measurement.rawStepKcal, 59.56, 0.01);
    expectWithin(measurement.stepKcal, 59.56, 0.01);
    expect(measurement.stepClamped).toBe(false);
  });
});

describe("checkinStep targets at day 28", () => {
  const [, , third] = goldenChain();

  it("should give 2140 kcal, P 126, F 73, C 245 from the trend weight on day 27", () => {
    expect(third.targets.calories_kcal).toBe(2140);
    expect(third.targets.protein_g).toBe(126);
    expect(third.targets.fat_g).toBe(73);
    expect(third.targets.carbs_g).toBe(245);
  });

  it("should read the trend weight of 79.0227 kg on day 27, not the raw 78.65 kg", () => {
    expectWithin(third.snapshot.trend_weight_kg ?? Number.NaN, 79.0227, 1e-4);
    expectWithin(third.targets.basis.trendWeightKg, 79.0227, 1e-4);
  });

  it("should leave deriveTargets at the raw 78.65 kg giving 2150 kcal, P 126, F 73, C 247", () => {
    const derived = deriveTargets({
      config: { goal: "lose", ratePctPerWeek: 0.5, proteinGPerKg: 1.6, fatFraction: 0.4 },
      tdee: 2579.54,
      trendWeight: 78.65,
      bmr: 1755,
    });

    expect([derived.caloriesKcal, derived.proteinG, derived.fatG, derived.carbsG]).toStrictEqual([
      2150, 126, 73, 247,
    ]);
  });

  it("should derive the targets from the new mu and record it as the basis tdee", () => {
    expectWithin(third.targets.basis.tdeeKcal, 2579.54, 0.5);
    expect(third.targets.basis.tdeeKcal).toBe(third.snapshot.mu_kcal);
  });

  it("should record the check-in basis from the program and the fixture", () => {
    expect(third.targets.basis).toMatchObject({
      source: "checkin",
      bmrKcal: 1755,
      goal: "lose",
      ratePctPerWeek: 0.5,
      proteinGPerKg: 1.6,
      fatFraction: 0.4,
      dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
      clamps: [],
    });
    expectWithin(third.targets.basis.effectiveRatePctPerWeek, 0.5057, 1e-4);
  });

  it("should give every weekday the same calories when the offsets are zero", () => {
    expect(third.targets.dow_calories_kcal).toStrictEqual([
      2140, 2140, 2140, 2140, 2140, 2140, 2140,
    ]);
  });

  it("should add the weekday offsets to the week's calories", () => {
    const withOffsets = checkinStep({
      ...inputAt(GOLDEN, 28, beliefOf(goldenChain()[1])),
      program: { ...GOLDEN.program, dowOffsetsKcal: [-300, 300, 0, 0, 0, 0, 0] },
    });

    expect(withOffsets.targets.dow_calories_kcal).toStrictEqual([
      1840, 2440, 2140, 2140, 2140, 2140, 2140,
    ]);
    expect(withOffsets.targets.basis.dowOffsetsKcal).toStrictEqual([-300, 300, 0, 0, 0, 0, 0]);
  });
});

describe("checkinStep rows", () => {
  const [, , third] = goldenChain();

  it("should name the snapshot a checkin as of the check-in day", () => {
    expect(third.snapshot.kind).toBe("checkin");
    expect(third.snapshot.as_of_date).toBe("2026-04-30");
  });

  it("should make the targets effective from the check-in day", () => {
    expect(third.targets.effective_from).toBe("2026-04-30");
  });

  it("should carry the engine version and the whole default params on both rows", () => {
    expect(third.snapshot.engine_version).toBe("keylow-engine-v1");
    expect(third.targets.engine_version).toBe("keylow-engine-v1");
    expect(third.snapshot.params).toStrictEqual(DEFAULT_ENGINE_PARAMS);
    expect(third.targets.params).toStrictEqual(DEFAULT_ENGINE_PARAMS);
  });

  it("should name exactly the snapshot columns of ADR 0002, Amendment 2", () => {
    expect(Object.keys(third.snapshot).sort()).toStrictEqual([
      "as_of_date",
      "engine_version",
      "kind",
      "measurement",
      "mu_kcal",
      "params",
      "trend_weight_kg",
      "var_kcal2",
    ]);
  });

  it("should name exactly the targets columns of ADR 0002, Amendment 2", () => {
    expect(Object.keys(third.targets).sort()).toStrictEqual([
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

  it("should name exactly the basis keys of ADR 0002, Amendment 2", () => {
    expect(Object.keys(third.targets.basis).sort()).toStrictEqual([
      "bmrKcal",
      "clamps",
      "dowOffsetsKcal",
      "effectiveRatePctPerWeek",
      "fatFraction",
      "goal",
      "proteinGPerKg",
      "ratePctPerWeek",
      "source",
      "tdeeKcal",
      "trendWeightKg",
    ]);
  });

  it("should record the params it was given, whole, on both rows", () => {
    const quietParams: EngineParams = {
      ...DEFAULT_ENGINE_PARAMS,
      expenditure: { ...DEFAULT_ENGINE_PARAMS.expenditure, processSdKcalPerWeek: 0 },
    };

    const result = checkinStep(inputAt(ineligibleCheckinFixture(DAY_ZERO), 14), quietParams);

    expect(result.snapshot.params).toStrictEqual(quietParams);
    expect(result.targets.params).toStrictEqual(quietParams);
    expect(result.snapshot.var_kcal2).toBe(140625);
  });
});

describe("checkinStep trend weight on the day before the check-in", () => {
  it("should ignore a weigh-in on the check-in day itself", () => {
    const input = inputAt(GOLDEN, 28, beliefOf(goldenChain()[1]));

    const result = checkinStep({
      ...input,
      weighIns: [...input.weighIns, { localDate: "2026-04-30", weightKg: 70 }],
    });

    expect(result.targets.calories_kcal).toBe(2140);
    expectWithin(result.snapshot.trend_weight_kg ?? Number.NaN, 79.0227, 1e-4);
  });

  it("should ignore weigh-ins after the check-in day", () => {
    const input = inputAt(GOLDEN, 14);

    const result = checkinStep({
      ...input,
      weighIns: [...input.weighIns, { localDate: "2026-05-20", weightKg: 60 }],
    });

    expectWithin(result.snapshot.mu_kcal, 2559.56, 0.5);
    expectWithin(result.snapshot.trend_weight_kg ?? Number.NaN, 79.5924, 1e-4);
  });

  it("should throw when there is no weigh-in and no onboarding weight", () => {
    expect(() => checkinStep({ ...inputAt(GOLDEN, 28), weighIns: [] })).toThrow(RangeError);
  });

  it("should not quote any value in the message it throws", () => {
    expect(() => checkinStep({ ...inputAt(GOLDEN, 28), weighIns: [] })).toThrow(
      "A check-in needs a weigh-in or an onboarding weight.",
    );
  });

  it("should throw when every weigh-in is dated on or after the check-in day", () => {
    expect(() =>
      checkinStep({
        ...inputAt(GOLDEN, 28),
        weighIns: [{ localDate: "2026-04-30", weightKg: 78 }],
      }),
    ).toThrow(RangeError);
  });
});

describe("checkinStep with no weigh-in and an onboarding weight", () => {
  const result = checkinStep({
    ...inputAt(GOLDEN, 14),
    weighIns: [],
    onboardingWeightKg: 80,
  });

  it("should record a null trend weight, because there is no trend", () => {
    expect(result.snapshot.trend_weight_kg).toBeNull();
  });

  it("should derive the targets from the onboarding weight and carry mu forward", () => {
    // tdee 2500, 80 kg: delta 0.005 * 80 * 7700 / 7 = 440, raw 2060, P 128, F 69, C 232.
    expect(result.snapshot.mu_kcal).toBe(2500);
    expect(result.targets.calories_kcal).toBe(2060);
    expect([result.targets.protein_g, result.targets.fat_g, result.targets.carbs_g]).toStrictEqual([
      128, 69, 232,
    ]);
  });

  it("should record the onboarding weight as the basis trend weight", () => {
    expect(result.targets.basis.trendWeightKg).toBe(80);
  });

  it("should record an ineligible measurement with no span and no weigh days", () => {
    expect(result.snapshot.measurement).toMatchObject({
      eligible: false,
      reasons: ["span", "weigh_days"],
      spanDays: 0,
      weighDays: 0,
      completeDays: 14,
    });
  });

  it("should parse through both program schemas, with a null trend weight on the row", () => {
    expect(expenditureMeasurementSchema.safeParse(result.snapshot.measurement).success).toBe(true);
    expect(targetsBasisSchema.safeParse(result.targets.basis).success).toBe(true);
  });

  it("should prefer the trend weight when a weigh-in exists", () => {
    const withWeighIns = checkinStep({
      ...inputAt(GOLDEN, 28, beliefOf(goldenChain()[1])),
      onboardingWeightKg: 90,
    });

    expect(withWeighIns.targets.calories_kcal).toBe(2140);
    expectWithin(withWeighIns.snapshot.trend_weight_kg ?? Number.NaN, 79.0227, 1e-4);
    expectWithin(withWeighIns.targets.basis.trendWeightKg, 79.0227, 1e-4);
  });
});

describe("checkinStep ineligible check-in (Q8)", () => {
  const fixture = ineligibleCheckinFixture(DAY_ZERO);
  const result = checkinStep(inputAt(fixture, 14));

  it("should find 9 complete days and fail the complete_days rule only", () => {
    expect(result.snapshot.measurement).toStrictEqual({
      eligible: false,
      reasons: ["complete_days"],
      spanDays: 14,
      weighDays: 14,
      completeDays: 9,
    });
  });

  it("should carry no update field on the ineligible measurement", () => {
    expect(result.snapshot.measurement).not.toHaveProperty("gain");
    expect(result.snapshot.measurement).not.toHaveProperty("rawStepKcal");
    expect(result.snapshot.measurement).not.toHaveProperty("stepKcal");
    expect(result.snapshot.measurement).not.toHaveProperty("stepClamped");
  });

  it("should leave mu at the prior 2500 and grow the variance to 146250", () => {
    expect(result.snapshot.mu_kcal).toBe(2500);
    expect(result.snapshot.var_kcal2).toBe(146250);
  });

  it("should carry the prior forward whatever it is", () => {
    const carried = checkinStep(inputAt(fixture, 14, { muKcal: 2300, varKcal2: 10000 }));

    expect(carried.snapshot.mu_kcal).toBe(2300);
    expect(carried.snapshot.var_kcal2).toBe(15625);
  });

  it("should rederive the targets from the carried mu 2500 and the day 13 trend weight", () => {
    expectWithin(result.snapshot.trend_weight_kg ?? Number.NaN, 79.5924, 1e-4);
    expect(result.targets.calories_kcal).toBe(2060);
    expect(result.targets.protein_g).toBe(127);
    expect(result.targets.fat_g).toBe(69);
    expect(result.targets.carbs_g).toBe(233);
  });

  it("should record the checkin source and the carried mu as the basis tdee", () => {
    expect(result.targets.basis.source).toBe("checkin");
    expect(result.targets.basis.tdeeKcal).toBe(2500);
  });
});

describe("checkinStep 6000 cap", () => {
  const constantWeighIns = [0, 1, 2].map((day) => ({
    localDate: addCalendarDays(DAY_ZERO, day),
    weightKg: 100,
  }));
  const gainProgram: CheckinProgram = {
    goal: "gain",
    ratePctPerWeek: 0.5,
    proteinGPerKg: 1.6,
    fatFraction: 0.4,
    dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
  };
  const result = checkinStep({
    asOfDate: addCalendarDays(DAY_ZERO, 3),
    prior: { muKcal: 5500, varKcal2: 140625 },
    weighIns: constantWeighIns,
    days: [],
    program: gainProgram,
    bmrKcal: 1755,
  });

  it("should cut a gain of 0.5 at 100 kg and a mu of 5500 (raw 6050) to 6000 kcal", () => {
    expect(result.targets.calories_kcal).toBe(6000);
  });

  it("should record profile_max in the clamps", () => {
    expect(result.targets.basis.clamps).toStrictEqual(["profile_max"]);
  });

  it("should split the macros again for the capped calories", () => {
    // 6050 kcal would give F 240 and C 813. 6000 kcal gives F 238 and C 805.
    expect(result.targets.protein_g).toBe(160);
    expect(result.targets.fat_g).toBe(238);
    expect(result.targets.carbs_g).toBe(805);
  });

  it("should restate the effective rate for the capped calories", () => {
    expectWithin(result.targets.basis.effectiveRatePctPerWeek, 0.4545, 1e-4);
  });

  it("should leave the weekday calories at what the capped week allows", () => {
    expect(result.targets.dow_calories_kcal).toStrictEqual([
      6000, 6000, 6000, 6000, 6000, 6000, 6000,
    ]);
  });

  it("should not change calories at or under 6000", () => {
    const lower = checkinStep({
      asOfDate: addCalendarDays(DAY_ZERO, 3),
      prior: { muKcal: 5400, varKcal2: 140625 },
      weighIns: constantWeighIns,
      days: [],
      program: gainProgram,
      bmrKcal: 1755,
    });

    expect(lower.targets.calories_kcal).toBe(5950);
    expect(lower.targets.basis.clamps).toStrictEqual([]);
  });
});

describe("checkinStep floor above tdee", () => {
  const result = checkinStep({
    asOfDate: addCalendarDays(DAY_ZERO, 3),
    prior: { muKcal: 1100, varKcal2: 10000 },
    weighIns: [0, 1, 2].map((day) => ({
      localDate: addCalendarDays(DAY_ZERO, day),
      weightKg: 60,
    })),
    days: [],
    program: {
      goal: "lose",
      ratePctPerWeek: 0.5,
      proteinGPerKg: 1.6,
      fatFraction: 0.4,
      dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
    },
    bmrKcal: 1300,
  });

  it("should give a lose user the floor of 1200 when mu is 1100", () => {
    expect(result.snapshot.mu_kcal).toBe(1100);
    expect(result.targets.calories_kcal).toBe(1200);
    expect(result.targets.basis.clamps).toStrictEqual(["floor"]);
  });

  it("should report a negative effective rate", () => {
    expectWithin(result.targets.basis.effectiveRatePctPerWeek, -0.1515, 1e-4);
  });
});

describe("checkinStep rows against the program schemas", () => {
  it("should parse an eligible check-in's measurement and basis", () => {
    const [, , third] = goldenChain();

    expect(expenditureMeasurementSchema.safeParse(third.snapshot.measurement).success).toBe(true);
    expect(targetsBasisSchema.safeParse(third.targets.basis).success).toBe(true);
  });

  it("should parse an ineligible check-in's measurement and basis", () => {
    const result = checkinStep(inputAt(ineligibleCheckinFixture(DAY_ZERO), 14));

    expect(expenditureMeasurementSchema.safeParse(result.snapshot.measurement).success).toBe(true);
    expect(targetsBasisSchema.safeParse(result.targets.basis).success).toBe(true);
  });

  it("should parse a capped check-in's basis", () => {
    const result = checkinStep({
      asOfDate: addCalendarDays(DAY_ZERO, 3),
      prior: { muKcal: 5500, varKcal2: 140625 },
      weighIns: [0, 1, 2].map((day) => ({
        localDate: addCalendarDays(DAY_ZERO, day),
        weightKg: 100,
      })),
      days: [],
      program: {
        goal: "gain",
        ratePctPerWeek: 0.5,
        proteinGPerKg: 1.6,
        fatFraction: 0.4,
        dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
      },
      bmrKcal: 1755,
    });

    const parsed = targetsBasisSchema.safeParse(result.targets.basis);

    expect(parsed.success).toBe(true);
    expect(parsed.data?.clamps).toStrictEqual(["profile_max"]);
  });

  it("should keep the update fields out of an ineligible measurement the schema reads back", () => {
    const result = checkinStep(inputAt(ineligibleCheckinFixture(DAY_ZERO), 14));
    const parsed = expenditureMeasurementSchema.safeParse(result.snapshot.measurement);

    expect(parsed.data).toStrictEqual({
      eligible: false,
      reasons: ["complete_days"],
      spanDays: 14,
      weighDays: 14,
      completeDays: 9,
    });
  });
});

describe("checkinStep purity", () => {
  it("should give deep-equal output for the same input twice", () => {
    const input = inputAt(GOLDEN, 21);

    expect(checkinStep(input)).toStrictEqual(checkinStep(input));
  });

  it("should not change its input", () => {
    const input = inputAt(GOLDEN, 21);
    const copy = structuredClone(input);

    checkinStep(input);

    expect(input).toStrictEqual(copy);
  });
});

describe("checkinStep threads the params through every stage", () => {
  function paramsWith(overrides: {
    trend?: Partial<EngineParams["trend"]>;
    expenditure?: Partial<EngineParams["expenditure"]>;
    targets?: Partial<EngineParams["targets"]>;
  }): EngineParams {
    return {
      ...DEFAULT_ENGINE_PARAMS,
      trend: { ...DEFAULT_ENGINE_PARAMS.trend, ...overrides.trend },
      expenditure: { ...DEFAULT_ENGINE_PARAMS.expenditure, ...overrides.expenditure },
      targets: { ...DEFAULT_ENGINE_PARAMS.targets, ...overrides.targets },
    };
  }

  const dayTwentyEight = inputAt(GOLDEN, 28, beliefOf(goldenChain()[1]));

  it("should read the trend alpha: 0.2 gives a day 27 trend weight of 78.8473 kg", () => {
    const result = checkinStep(dayTwentyEight, paramsWith({ trend: { alpha: 0.2 } }));

    expectWithin(result.snapshot.trend_weight_kg ?? Number.NaN, 78.8473, 1e-4);
  });

  it("should read the measurement params: minCompleteDays 9 makes the 9 complete day window eligible", () => {
    const result = checkinStep(
      inputAt(ineligibleCheckinFixture(DAY_ZERO), 14),
      paramsWith({ expenditure: { minCompleteDays: 9 } }),
    );

    expect(result.snapshot.measurement.eligible).toBe(true);
    expect(result.snapshot.measurement).toMatchObject({ completeDays: 9 });
  });

  it("should read the update params of an eligible check-in: no process noise gives a gain of 0.69242", () => {
    const result = checkinStep(
      inputAt(GOLDEN, 14),
      paramsWith({ expenditure: { processSdKcalPerWeek: 0 } }),
    );
    const { measurement } = result.snapshot;
    if (!measurement.eligible) throw new Error("expected an eligible measurement");

    expectWithin(measurement.gain, 0.69242, 1e-5);
    expectWithin(result.snapshot.var_kcal2, 43253.8, 0.5);
  });

  it("should read the update params of an ineligible check-in: no process noise keeps the variance", () => {
    const result = checkinStep(
      inputAt(ineligibleCheckinFixture(DAY_ZERO), 14),
      paramsWith({ expenditure: { processSdKcalPerWeek: 0 } }),
    );

    expect(result.snapshot.var_kcal2).toBe(140625);
  });

  it("should read the targets params: rounding to 5 gives 2145 kcal, P 126, F 73, C 246 on day 28", () => {
    const result = checkinStep(dayTwentyEight, paramsWith({ targets: { roundToKcal: 5 } }));

    expect(result.targets.calories_kcal).toBe(2145);
    expect([result.targets.protein_g, result.targets.fat_g, result.targets.carbs_g]).toStrictEqual([
      126, 73, 246,
    ]);
  });

  describe("in the 6000 cap", () => {
    const weighIns = [0, 1, 2].map((day) => ({
      localDate: addCalendarDays(DAY_ZERO, day),
      weightKg: 100,
    }));
    const capInput = (muKcal: number): CheckinInput => ({
      asOfDate: addCalendarDays(DAY_ZERO, 3),
      prior: { muKcal, varKcal2: 140625 },
      weighIns,
      days: [],
      program: {
        goal: "gain",
        ratePctPerWeek: 0.5,
        proteinGPerKg: 1.6,
        fatFraction: 0.4,
        dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
      },
      bmrKcal: 1755,
    });

    it("should split the capped macros with the params: protein held to 1 g/kg gives P 100, F 249, C 840", () => {
      const result = checkinStep(capInput(5500), paramsWith({ targets: { proteinMaxGPerKg: 1 } }));

      expect(result.targets.calories_kcal).toBe(6000);
      expect([
        result.targets.protein_g,
        result.targets.fat_g,
        result.targets.carbs_g,
      ]).toStrictEqual([100, 249, 840]);
    });

    it("should restate the capped rate with the params: 7000 kcal a kg gives 0.4 % a week", () => {
      const result = checkinStep(
        capInput(5600),
        paramsWith({ expenditure: { energyDensityKcalPerKg: 7000 } }),
      );

      expect(result.targets.calories_kcal).toBe(6000);
      expectWithin(result.targets.basis.effectiveRatePctPerWeek, 0.4, 1e-6);
    });
  });
});

describe("checkinStep floor from the BMR", () => {
  it("should lift a lose target to 0.9 x BMR when that beats 1200: BMR 1800 gives 1620", () => {
    const result = checkinStep({
      asOfDate: addCalendarDays(DAY_ZERO, 3),
      prior: { muKcal: 1500, varKcal2: 10000 },
      weighIns: [0, 1, 2].map((day) => ({
        localDate: addCalendarDays(DAY_ZERO, day),
        weightKg: 60,
      })),
      days: [],
      program: {
        goal: "lose",
        ratePctPerWeek: 0.5,
        proteinGPerKg: 1.6,
        fatFraction: 0.4,
        dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
      },
      bmrKcal: 1800,
    });

    expect(result.targets.calories_kcal).toBe(1620);
    expect(result.targets.basis.clamps).toStrictEqual(["floor"]);
    expect(result.targets.basis.bmrKcal).toBe(1800);
    expectWithin(result.targets.basis.effectiveRatePctPerWeek, -0.1818, 1e-4);
  });
});

describe("checkinStep weekly step clamp", () => {
  const result = checkinStep(inputAt(GOLDEN, 14, { muKcal: 1800, varKcal2: 140625 }));
  const { measurement } = result.snapshot;
  if (!measurement.eligible) throw new Error("expected an eligible measurement");

  it("should record a raw step of 550 held to 250, and the clamp", () => {
    expectWithin(measurement.rawStepKcal, 550.06, 0.1);
    expect(measurement.stepKcal).toBe(250);
    expect(measurement.stepClamped).toBe(true);
  });

  it("should move mu by the clamped step, from 1800 to 2050", () => {
    expect(result.snapshot.mu_kcal).toBe(2050);
  });
});
