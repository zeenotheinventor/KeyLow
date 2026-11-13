import * as copy from "../../../src/copy";

// Every function `src/copy/assistantRecipeCompareCard.ts` exports, called with representative arguments.
export const samples: Record<string, () => string[]> = {
  describeAdjustedRecipeName: () => [copy.describeAdjustedRecipeName("Eval chicken and rice")],
  describeRecipeCompareChange: () => [
    copy.describeRecipeCompareChange("protein_g", 30),
    copy.describeRecipeCompareChange("carbs_g", -20),
    copy.describeRecipeCompareChange("kcal", -150),
  ],
  describeRecipeCompareSubtitle: () => [
    copy.describeRecipeCompareSubtitle("30 g more protein a serving", 2, false),
    copy.describeRecipeCompareSubtitle(null, 1, true),
  ],
  describeRecipeCompareFitWithin: () => [
    copy.describeRecipeCompareFitWithin({ kcal: 518, protein_g: 79 }) ?? "",
    copy.describeRecipeCompareFitWithin({ protein_g: 60, carbs_g: 40, fat_g: 10, kcal: 500 }) ?? "",
  ],
  describeRecipeCompareAmounts: () => [
    copy.describeRecipeCompareAmounts({ change: "changed", before: 260, grams: 455 }, true),
    copy.describeRecipeCompareAmounts({ change: "same", before: 160, grams: 160 }, true),
    copy.describeRecipeCompareAmounts({ change: "same", before: 0, grams: 0 }, true),
    copy.describeRecipeCompareAmounts({ change: "added", before: null, grams: 120 }, true),
    copy.describeRecipeCompareAmounts({ change: "removed", before: 30, grams: 0 }, false),
  ],
  describeRecipeCompareStays: () => [copy.describeRecipeCompareStays("Eval chicken and rice")],
  describeRecipeRefusal: () => [
    ...Object.values(
      copy.describeRecipeRefusal({
        recipeName: "Eval porridge bowl",
        nutrient: "protein_g",
        target: 53,
        reached: 17,
        reachedKcal: 389,
      }),
    ),
    copy.describeRecipeRefusal({
      recipeName: "Eval porridge bowl",
      nutrient: "kcal",
      target: 250,
      reached: 389,
      reachedKcal: null,
    }).body,
  ],
};
