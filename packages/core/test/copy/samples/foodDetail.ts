import * as copy from "../../../src/copy";
import { collectStrings } from "../collectStrings";

// Every function `src/copy/foodDetail.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeNutritionHeading: () =>
    (["per_100g", "per_100ml"] as const).map(copy.describeNutritionHeading),
  describeMissingValues: () => [
    copy.describeMissingValues([], undefined),
    copy.describeMissingValues(["protein_g"], undefined),
    copy.describeMissingValues(["kcal", "carbs_g"], undefined),
    copy.describeMissingValues(["fibre_g"], "us_total"),
  ],
  describeMissingValuesBeforeLogging: () => [
    copy.describeMissingValuesBeforeLogging([], undefined),
    copy.describeMissingValuesBeforeLogging(["carbs_g"], undefined),
    copy.describeMissingValuesBeforeLogging(["kcal", "carbs_g"], undefined),
    copy.describeMissingValuesBeforeLogging(["fibre_g"], "us_total"),
  ],
  nutrientRows: () =>
    [
      { kcal: 148, protein_g: 31.2, carbs_g: 0, fat_g: 7.5, fibre_g: 12 },
      { kcal: null, protein_g: null, carbs_g: null, fat_g: null, fibre_g: null },
    ].flatMap((food) => copy.nutrientRows(food).flatMap(collectStrings)),
};
