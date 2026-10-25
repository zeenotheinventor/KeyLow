import { describe, expect, it } from "vitest";

import * as core from "../../src";
import * as weight from "../../src/weight";

describe("the weight module", () => {
  it("should be re-exported by the package root", () => {
    for (const [name, value] of Object.entries(weight)) {
      expect(core).toHaveProperty(name, value);
    }
  });

  it("should export its public surface", () => {
    expect(Object.keys(weight).sort()).toEqual([
      "BODY_FAT_MAX_PCT",
      "BODY_FAT_MIN_PCT",
      "HEALTH_IMPORT_OVERLAP_DAYS",
      "HEALTH_SAMPLE_ID_MAX_CHARS",
      "KILOGRAMS_PER_POUND",
      "LEAN_MASS_MAX_KG",
      "LEAN_MASS_MIN_KG",
      "TREND_SETTLED_OBS",
      "WEIGHT_RANGES",
      "WEIGH_IN_MAX_KG",
      "WEIGH_IN_MIN_KG",
      "WEIGH_IN_NOTE_MAX_CHARS",
      "bodyChangeOverRange",
      "bodyPointsInRange",
      "buildManualWeighIn",
      "checkWeightKg",
      "composeBodySplit",
      "computeBodyTrend",
      "displayWeight",
      "isBodyTrendSettling",
      "isTrendSettling",
      "kgToLb",
      "lbToKg",
      "mapHealthBodyFatSamples",
      "mapHealthLeanMassSamples",
      "mapHealthSample",
      "mapHealthSamples",
      "parseWeightInput",
      "parseWeightInputIn",
      "pointsInRange",
      "rangeWindow",
      "validateNote",
      "weeklyRateKg",
      "weighInsInRange",
    ]);
  });
});
