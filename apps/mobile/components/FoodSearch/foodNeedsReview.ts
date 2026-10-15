import { requiresConfirmation } from "@keylow/core/foods";

import type { Food } from "@keylow/core/schemas";

/**
 * Whether a food must be reviewed before its first log, so its row shows "Needs review" and a chevron in
 * place of the plus: it is flagged suspect, or it is missing its energy or a macro. A nutrient of 0 is given.
 */
export function foodNeedsReview(
  food: Pick<Food, "kcal" | "protein_g" | "fat_g" | "carbs_g" | "quality">,
): boolean {
  return (
    requiresConfirmation(food) ||
    food.kcal === null ||
    food.protein_g === null ||
    food.fat_g === null ||
    food.carbs_g === null
  );
}
