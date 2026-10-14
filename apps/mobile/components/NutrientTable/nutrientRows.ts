import { FOOD_NUTRIENT_LABELS } from "@keylow/core/copy";
import { formatCalories, formatGrams } from "@keylow/core/format";

import type { NutrientTableFood } from "./types";

type NutrientRowContent = {
  label: string;
  /** The value with its unit, or null when the source does not give it. */
  value: string | null;
};

const withGrams = (grams: number | null): string | null =>
  grams === null ? null : `${formatGrams(grams)} g`;

/**
 * The rows of the nutrition table in the order the boards draw them. A value the source does not give
 * is null and never 0, which would read as a measurement.
 */
export function nutrientRows(food: NutrientTableFood): NutrientRowContent[] {
  return [
    {
      label: FOOD_NUTRIENT_LABELS.energy,
      value: food.kcal === null ? null : `${formatCalories(food.kcal)} kcal`,
    },
    { label: FOOD_NUTRIENT_LABELS.protein, value: withGrams(food.protein_g) },
    { label: FOOD_NUTRIENT_LABELS.carbohydrate, value: withGrams(food.carbs_g) },
    { label: FOOD_NUTRIENT_LABELS.fat, value: withGrams(food.fat_g) },
    { label: FOOD_NUTRIENT_LABELS.fibre, value: withGrams(food.fibre_g) },
  ];
}
