import { previewRecipeAmount, recipeAmountStart } from "@keylow/core/diary";

import type { RecipeSummary } from "@keylow/api-client";

/**
 * Whether the diary offers a recipe for logging: one serving can be logged and every figure of a serving is
 * there. One with no weight cannot be logged (one serving of nothing is nothing). One missing a value has no
 * board for its amount step (the hero's macros, and the stored entry, would be incomplete), and its search row
 * would say "Needs review" with no plus. The log search lists only such recipes, and its amount step finds
 * only such recipes, so a link to any other is not found.
 */
export function canLogRecipe(recipe: RecipeSummary): boolean {
  const { kcal, protein_g, carbs_g, fat_g } = recipe.computed.perServing;

  return (
    previewRecipeAmount(recipe, recipeAmountStart()) !== null &&
    kcal !== null &&
    protein_g !== null &&
    carbs_g !== null &&
    fat_g !== null
  );
}
