import * as copy from "../../../src/copy";
import { freezeRecipe, withRecipeQuantity } from "../../../src/diary/recipeSnapshotQuantity";

const chickenAndRice = {
  servings: 4,
  computed: {
    effectiveGrams: 1100,
    perServing: { kcal: 374.2, protein_g: 31.625, carbs_g: 42.55, fat_g: 8.125, fibre_g: null },
  },
};

const frozenChickenAndRice = freezeRecipe({
  id: "00000000-0000-4000-8000-0000000000b1",
  name: "Chicken and rice",
  servings: 4,
  yield_grams: 1100,
  computed: {
    effectiveGrams: 1100,
    total: { kcal: 1496.8, protein_g: 126.5, carbs_g: 170.2, fat_g: 32.5, fibre_g: null },
  },
});

// Every function `src/copy/recipeLog.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeServingSuffix: () => [1, 1.5].map(copy.describeServingSuffix),
  describeRecipeServing: () => [copy.describeRecipeServing(chickenAndRice)],
  describeRecipeLoggedAmount: () => [
    copy.describeRecipeLoggedAmount({ unit: "serving", quantity: 1.5, resolvedGrams: 412.5 }),
    copy.describeRecipeLoggedAmount({ unit: "g", quantity: 300, resolvedGrams: 300 }),
  ],
  describeRecipeAmountBasis: () => [
    copy.describeRecipeAmountBasis({ unit: "serving", quantity: 1, resolvedGrams: 275 }),
    copy.describeRecipeAmountBasis({ unit: "g", quantity: 300, resolvedGrams: 300 }),
  ],
  describeRecipeYield: () => [copy.describeRecipeYield(4, 1100), copy.describeRecipeYield(4, null)],
  describeRecipePer100Heading: () => [
    copy.describeRecipePer100Heading(1100),
    copy.describeRecipePer100Heading(null),
  ],
  describeRawGramsNote: () => [copy.describeRawGramsNote(720)],
  describeSpokenRawGramsNote: () => [copy.describeSpokenRawGramsNote(275, 720)],
  describeRecipeSearchRowName: () => [
    copy.describeRecipeSearchRowName("Chicken and rice", chickenAndRice),
  ],
  describeRecipeLoggedRowName: () => [
    copy.describeRecipeLoggedRowName(
      "18:00",
      withRecipeQuantity(frozenChickenAndRice, { unit: "serving", quantity: 1 }),
    ),
  ],
};
