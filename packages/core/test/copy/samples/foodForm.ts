import * as copy from "../../../src/copy";

// Every function `src/copy/foodForm.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeNameProblem: () => (["required", "too_long"] as const).map(copy.describeNameProblem),
  describeNutrientProblem: () =>
    (["kcal", "protein_g", "fat_g", "carbs_g", "fibre_g"] as const).flatMap((nutrient) =>
      (["required", "negative", "not_a_number", "too_large"] as const).map((problem) =>
        copy.describeNutrientProblem(nutrient, problem),
      ),
    ),
  describePortionField: () =>
    (["label", "remove", "default"] as const).map((field) => copy.describePortionField(field, 1)),
  describePortionAmountField: () =>
    (["per_100g", "per_100ml"] as const).map((basis) => copy.describePortionAmountField(1, basis)),
  describeAmountUnitNote: () =>
    (["per_100g", "per_100ml"] as const).map(copy.describeAmountUnitNote),
  describePortionLabelField: () => [1, 2].map(copy.describePortionLabelField),
  describeRemovePortion: () => [
    copy.describeRemovePortion("Slice", 1),
    copy.describeRemovePortion("", 2),
  ],
  describePortionGroup: () => [1, 2].map(copy.describePortionGroup),
  describePortionLabelProblem: () => [1, 2].map(copy.describePortionLabelProblem),
  describePortionAmountProblem: () => [1, 2].map(copy.describePortionAmountProblem),
  describePortionLabelAndAmountProblem: () => [1, 2].map(copy.describePortionLabelAndAmountProblem),
};
