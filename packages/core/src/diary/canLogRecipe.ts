import { previewRecipeAmount, recipeAmountStart } from "./previewRecipeAmount";

import type { LoggableRecipe } from "./recipeSnapshotQuantity";
import type { RecipeComputed } from "../recipes/schemas";

/**
 * Whether the diary offers a recipe for logging: one serving can be logged and every figure of a serving
 * is there. One with no weight cannot be logged (one serving of nothing is nothing). One missing a value
 * has no amount step to open (the hero's macros, and the stored entry, would be incomplete), and its
 * search row would say "Needs review" with no plus. A search lists only recipes this accepts.
 */
export const canLogRecipe = (
  recipe: LoggableRecipe & { computed: Pick<RecipeComputed, "perServing"> },
): boolean => {
  const { kcal, protein_g, carbs_g, fat_g } = recipe.computed.perServing;

  return (
    previewRecipeAmount(recipe, recipeAmountStart()) !== null &&
    kcal !== null &&
    protein_g !== null &&
    carbs_g !== null &&
    fat_g !== null
  );
};
