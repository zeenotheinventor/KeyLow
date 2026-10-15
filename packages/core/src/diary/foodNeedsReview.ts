import { requiresConfirmation } from "../foods/quality";

import type { Food } from "../schemas/food";

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

const NUTRIENT_FIELDS = ["kcal", "protein_g", "carbs_g", "fat_g"] as const;

/**
 * The nutrients the food does not give, for the notice that says so: the ones the source flagged and the
 * ones that are null, so a food with a gap the flag does not name still says what is missing.
 */
export function missingFieldsOf(
  food: Pick<Food, "kcal" | "protein_g" | "fat_g" | "carbs_g" | "quality">,
): string[] {
  const nullFields = NUTRIENT_FIELDS.filter((field) => food[field] === null);

  return [...new Set([...(food.quality.fields_missing ?? []), ...nullFields])];
}
