import { describe, expect, it } from "vitest";

import * as setup from "../../src/setup";

describe("the setup module", () => {
  it("should export its public surface", () => {
    expect(Object.keys(setup).sort()).toEqual([
      "DEFAULT_DIET_STYLE",
      "DEFAULT_PROTEIN_PRESET",
      "DEFAULT_RATE_PCT_PER_WEEK",
      "DIET_FAT_FRACTION_OF_REMAINDER",
      "DIET_STYLES",
      "GOALS",
      "HEIGHT_MAX_CM",
      "HEIGHT_MIN_CM",
      "HEIGHT_UNITS",
      "MAX_AGE_YEARS",
      "MIN_AGE_YEARS",
      "PROFILE_MAX_KCAL",
      "PROTEIN_G_PER_KG",
      "PROTEIN_PRESETS",
      "RATE_PRESETS_PCT_PER_WEEK",
      "SETUP_STEPS",
      "bindingCalorieClamp",
      "capToProfileRange",
      "checkBirthDate",
      "checkHeightCm",
      "defaultGoalForAge",
      "defaultUnitsForRegion",
      "entryWeightUnit",
      "goalsAllowed",
      "nextStep",
      "parseHeightInput",
      "previousStep",
      "progressFraction",
      "ratePerWeekKg",
      "resetGoalForAge",
      "setupAnswersSchemaFor",
      "startingPlan",
      "stepCount",
      "stepNumber",
      "weightUnitToSave",
      "withGoal",
    ]);
  });
});
