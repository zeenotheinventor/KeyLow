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

  it("should hold only the version and the trend and expenditure groups at the top level", () => {
    expect(Object.keys(DEFAULT_ENGINE_PARAMS).sort()).toStrictEqual([
      "expenditure",
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
      "priorCv",
      "sexOffsetKcal",
      "zClampKcal",
    ]);
  });
});
