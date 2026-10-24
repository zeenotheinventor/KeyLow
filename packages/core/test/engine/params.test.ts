import { describe, expect, it } from "vitest";

import { DEFAULT_ENGINE_PARAMS, ENGINE_VERSION } from "../../src/engine/params";

// One literal per constant, never read back from the module under test, so editing any constant in
// params.ts turns at least one of these red.
describe("DEFAULT_ENGINE_PARAMS", () => {
  it("should name the engine version keylow-engine-v1", () => {
    expect(ENGINE_VERSION).toBe("keylow-engine-v1");
    expect(DEFAULT_ENGINE_PARAMS.version).toBe("keylow-engine-v1");
  });

  it("should smooth with an alpha of 0.10", () => {
    expect(DEFAULT_ENGINE_PARAMS.trend.alpha).toBe(0.1);
  });

  it("should split a segment after a gap of more than 30 days", () => {
    expect(DEFAULT_ENGINE_PARAMS.trend.maxGapDays).toBe(30);
  });

  it("should start screening spikes after 5 accepted readings", () => {
    expect(DEFAULT_ENGINE_PARAMS.trend.winsorMinObs).toBe(5);
  });

  it("should reject a spike more than 15% from the trend", () => {
    expect(DEFAULT_ENGINE_PARAMS.trend.rejectPct).toBe(0.15);
  });

  it("should winsorise to 2.5% either side of the trend", () => {
    expect(DEFAULT_ENGINE_PARAMS.trend.winsorPct).toBe(0.025);
  });

  it("should hold only the version and the trend, expenditure and targets groups at the top level", () => {
    expect(Object.keys(DEFAULT_ENGINE_PARAMS).sort()).toStrictEqual([
      "expenditure",
      "targets",
      "trend",
      "version",
    ]);
  });

  it("should hold exactly the trend defaults in the trend group", () => {
    expect(DEFAULT_ENGINE_PARAMS.trend).toStrictEqual({
      alpha: 0.1,
      winsorPct: 0.025,
      rejectPct: 0.15,
      winsorMinObs: 5,
      maxGapDays: 30,
    });
  });
});

describe("DEFAULT_ENGINE_PARAMS expenditure group", () => {
  it("should use an energy density of 7700 kcal per kg", () => {
    expect(DEFAULT_ENGINE_PARAMS.expenditure.energyDensityKcalPerKg).toBe(7700);
  });

  it("should start the expenditure estimate with a coefficient of variation of 0.15", () => {
    expect(DEFAULT_ENGINE_PARAMS.expenditure.priorCv).toBe(0.15);
  });

  it("should clamp the expenditure estimate to 800 to 6000 kcal", () => {
    expect(DEFAULT_ENGINE_PARAMS.expenditure.zClampKcal).toStrictEqual({ min: 800, max: 6000 });
  });

  it("should add 5 kcal for male, take off 161 for female and 78 for other", () => {
    expect(DEFAULT_ENGINE_PARAMS.expenditure.sexOffsetKcal).toStrictEqual({
      male: 5,
      female: -161,
      other: -78,
    });
  });

  it("should use the five activity factors 1.2, 1.375, 1.55, 1.725 and 1.9", () => {
    expect(DEFAULT_ENGINE_PARAMS.expenditure.activityFactors).toStrictEqual({
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      very: 1.725,
      extra: 1.9,
    });
  });

  it("should accept an activity factor override from 1.2 to 1.9", () => {
    expect(DEFAULT_ENGINE_PARAMS.expenditure.activityFactorBand).toStrictEqual({
      min: 1.2,
      max: 1.9,
    });
  });

  it("should hold exactly these expenditure defaults and nothing else", () => {
    expect(Object.keys(DEFAULT_ENGINE_PARAMS.expenditure).sort()).toStrictEqual([
      "activityFactorBand",
      "activityFactors",
      "energyDensityKcalPerKg",
      "incompletePenaltyKcal",
      "intakeCvPerDay",
      "minCompleteDays",
      "minSpanDays",
      "minWeighDays",
      "priorCv",
      "residualSdFloorKg",
      "sexOffsetKcal",
      "windowDays",
      "zClampKcal",
    ]);
  });

  it("should measure over a window of 28 days", () => {
    expect(DEFAULT_ENGINE_PARAMS.expenditure.windowDays).toBe(28);
  });

  it("should need a span of 14 days between the first and last weigh-in", () => {
    expect(DEFAULT_ENGINE_PARAMS.expenditure.minSpanDays).toBe(14);
  });

  it("should need 8 weigh days in the window", () => {
    expect(DEFAULT_ENGINE_PARAMS.expenditure.minWeighDays).toBe(8);
  });

  it("should need 10 complete days in the window", () => {
    expect(DEFAULT_ENGINE_PARAMS.expenditure.minCompleteDays).toBe(10);
  });

  it("should floor the residual standard deviation of the weight at 0.3 kg", () => {
    expect(DEFAULT_ENGINE_PARAMS.expenditure.residualSdFloorKg).toBe(0.3);
  });

  it("should take the standard deviation of a day's logged intake as 15% of the mean", () => {
    expect(DEFAULT_ENGINE_PARAMS.expenditure.intakeCvPerDay).toBe(0.15);
  });

  it("should penalise an incomplete window by 100 kcal at most", () => {
    expect(DEFAULT_ENGINE_PARAMS.expenditure.incompletePenaltyKcal).toBe(100);
  });
});

describe("DEFAULT_ENGINE_PARAMS targets group", () => {
  it("should floor a lose goal at 1200 kcal", () => {
    expect(DEFAULT_ENGINE_PARAMS.targets.floorAbsKcal).toBe(1200);
  });

  it("should floor a lose goal at 0.9 times the BMR", () => {
    expect(DEFAULT_ENGINE_PARAMS.targets.floorBmrFactor).toBe(0.9);
  });

  it("should cap a deficit at 30% of tdee", () => {
    expect(DEFAULT_ENGINE_PARAMS.targets.maxDeficitFrac).toBe(0.3);
  });

  it("should cap a surplus at 20% of tdee", () => {
    expect(DEFAULT_ENGINE_PARAMS.targets.maxSurplusFrac).toBe(0.2);
  });

  it("should cap a loss at 1.0% of body weight a week", () => {
    expect(DEFAULT_ENGINE_PARAMS.targets.maxLossPct).toBe(1.0);
  });

  it("should cap a gain at 0.5% of body weight a week", () => {
    expect(DEFAULT_ENGINE_PARAMS.targets.maxGainPct).toBe(0.5);
  });

  it("should round calories to the nearest 10 kcal", () => {
    expect(DEFAULT_ENGINE_PARAMS.targets.roundToKcal).toBe(10);
  });

  it("should offer the protein presets moderate 1.6, high 2.0 and very high 2.2 g/kg", () => {
    expect(DEFAULT_ENGINE_PARAMS.targets.proteinPresets).toStrictEqual({
      moderate: 1.6,
      high: 2.0,
      very_high: 2.2,
    });
  });

  it("should cap protein at 3.0 g/kg", () => {
    expect(DEFAULT_ENGINE_PARAMS.targets.proteinMaxGPerKg).toBe(3.0);
  });

  it("should offer the fat fractions balanced 0.40, low_fat 0.28 and low_carb 0.60", () => {
    expect(DEFAULT_ENGINE_PARAMS.targets.fatFractions).toStrictEqual({
      balanced: 0.4,
      low_fat: 0.28,
      low_carb: 0.6,
    });
  });

  it("should keep fat at 0.5 g/kg or more", () => {
    expect(DEFAULT_ENGINE_PARAMS.targets.fatMinGPerKg).toBe(0.5);
  });

  it("should hold exactly these targets defaults and no second energy density", () => {
    expect(Object.keys(DEFAULT_ENGINE_PARAMS.targets).sort()).toStrictEqual([
      "fatFractions",
      "fatMinGPerKg",
      "floorAbsKcal",
      "floorBmrFactor",
      "maxDeficitFrac",
      "maxGainPct",
      "maxLossPct",
      "maxSurplusFrac",
      "proteinMaxGPerKg",
      "proteinPresets",
      "roundToKcal",
    ]);
  });
});
