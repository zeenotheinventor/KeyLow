import * as copy from "../../../src/copy";

import type { RecipeDraftProblem } from "../../../src/recipes";

const problemCodes: RecipeDraftProblem[] = [
  "name_required",
  "name_too_long",
  "servings_invalid",
  "servings_too_many",
  "cooked_weight_invalid",
  "cooked_weight_too_large",
  "ingredients_none",
  "ingredients_too_many",
  "ingredient_invalid",
  "steps_too_many",
  "step_too_long",
];

const perServing = { kcal: 374.2, protein_g: 31.625, carbs_g: 42.55, fat_g: 8.125 };

// Every function `src/copy/recipeEditor.ts` exports, called with representative arguments. The voice test fails
// when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeRecipeProblem: () => problemCodes.map(copy.describeRecipeProblem),
  describeServingsFieldSuffix: () => ["1", "4"].map(copy.describeServingsFieldSuffix),
  describeCookedWeightHelper: () => [
    copy.describeCookedWeightHelper([{ resolved_grams: 500 }, { resolved_grams: 220 }]),
    copy.describeCookedWeightHelper([]),
  ],
  describeRecipePerServing: () => [copy.describeRecipePerServing(275)],
  describeRecipePer100: () => [
    copy.describeRecipePer100("cooked", 136),
    copy.describeRecipePer100("raw", 208),
    copy.describeRecipePer100("raw", null),
  ],
  describeRecipePerServingCard: () => [
    copy.describeRecipePerServingCard(perServing),
    copy.describeRecipePerServingCard({ kcal: 1, protein_g: 1, carbs_g: 1, fat_g: 1 }),
    copy.describeRecipePerServingCard({ ...perServing, kcal: null }),
    copy.describeRecipePerServingCard({ ...perServing, carbs_g: null }),
  ],
  describeRemoveIngredient: () => [copy.describeRemoveIngredient("Onions, raw")],
  describeIngredientRowName: () => [
    copy.describeIngredientRowName("Onions, raw", "1 medium (110 g)"),
  ],
  describeChooseAmountRowName: () => [
    copy.describeChooseAmountRowName("Spinach, baby, raw", "100 g"),
    copy.describeChooseAmountRowName("Protein bar", "1 bar (60 g)", {
      brand: "Barebells",
      needsReview: true,
    }),
  ],
  describeStepTitle: () => [copy.describeStepTitle(3)],
  describeStepTextName: () => [copy.describeStepTextName(3)],
  describeStepLength: () => [
    copy.describeStepLength("x".repeat(201)),
    copy.describeStepLength("x".repeat(1001)),
  ],
  describeMoveStep: () => [copy.describeMoveStep(1, "up"), copy.describeMoveStep(1, "down")],
  describeStepMoved: () => [copy.describeStepMoved(1, 5)],
  describeEditStep: () => [copy.describeEditStep(3)],
  describeRemoveStep: () => [copy.describeRemoveStep(3)],
  describeStepRowName: () => [copy.describeStepRowName(3, "Heat the oil in a large pan.")],
  describeCountSuffix: () => [1, 3].map(copy.describeCountSuffix),
  describeCountedHeading: () => [
    copy.describeCountedHeading(copy.REFRESH.changed, 1),
    copy.describeCountedHeading(copy.RECIPE_EDITOR.ingredients, 0),
  ],
};
