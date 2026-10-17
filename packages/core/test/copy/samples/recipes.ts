import * as copy from "../../../src/copy";

const chickenAndRice = {
  servings: 4,
  computed: {
    effectiveGrams: 1100,
    perServing: { kcal: 374.2, protein_g: 31.625, carbs_g: 42.55, fat_g: 8.125, fibre_g: null },
  },
};

// Every function `src/copy/recipes.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeRecipeServingCaption: () => [
    copy.describeRecipeServingCaption(chickenAndRice),
    copy.describeRecipeServingCaption({ ...chickenAndRice, servings: 1 }),
  ],
  describeRecipeRowName: () => [copy.describeRecipeRowName("Chicken and rice", chickenAndRice)],
  describeMoreForRecipe: () => [copy.describeMoreForRecipe("Chicken and rice")],
  describeRestoreRecipe: () => [copy.describeRestoreRecipe("Turkey meatballs")],
  describeDuplicateRecipe: () => [copy.describeDuplicateRecipe("Chicken and rice")],
  describeArchiveRecipe: () => [copy.describeArchiveRecipe("Chicken and rice")],
  describeArchivedLink: () => [1, 2].map(copy.describeArchivedLink),
  describeArchivedLinkName: () => [1, 2].map(copy.describeArchivedLinkName),
  describeRecipeCount: () => [0, 1, 2].map(copy.describeRecipeCount),
  describeDuplicateName: () => [
    copy.describeDuplicateName("Chicken and rice", []),
    copy.describeDuplicateName("Chicken and rice", ["Chicken and rice (copy)"]),
  ],
};
