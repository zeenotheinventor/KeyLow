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
      "HEALTH_IMPORT_OVERLAP_DAYS",
      "HEALTH_SAMPLE_ID_MAX_CHARS",
      "KILOGRAMS_PER_POUND",
      "TREND_SETTLED_OBS",
      "WEIGHT_RANGES",
      "WEIGH_IN_MAX_KG",
      "WEIGH_IN_MIN_KG",
      "WEIGH_IN_NOTE_MAX_CHARS",
      "buildManualWeighIn",
      "displayWeight",
      "isTrendSettling",
      "kgToLb",
      "lbToKg",
      "mapHealthSample",
      "mapHealthSamples",
      "parseWeightInput",
      "pointsInRange",
      "rangeWindow",
      "validateNote",
      "weeklyRateKg",
      "weighInsInRange",
    ]);
  });
});
