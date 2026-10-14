import { FOOD_NUTRIENT_LABELS } from "@keylow/core/copy";
import { formatCalories, formatGrams } from "@keylow/core/format";

import type { NutrientRow } from "@/components/ui/NutrientTable";
import type { Food } from "@keylow/core/schemas";

type NutrientRowsFood = Pick<Food, "kcal" | "protein_g" | "carbs_g" | "fat_g" | "fibre_g">;

const grams = (amount: number | null) => (amount === null ? null : `${formatGrams(amount)} g`);

/** The rows of the nutrition table, in the order the design draws them. A nutrient not given is null. */
export const nutrientRows = (food: NutrientRowsFood): NutrientRow[] => [
  {
    label: FOOD_NUTRIENT_LABELS.energy,
    value: food.kcal === null ? null : `${formatCalories(food.kcal)} kcal`,
  },
  { label: FOOD_NUTRIENT_LABELS.protein, value: grams(food.protein_g) },
  { label: FOOD_NUTRIENT_LABELS.carbohydrate, value: grams(food.carbs_g) },
  { label: FOOD_NUTRIENT_LABELS.fat, value: grams(food.fat_g) },
  { label: FOOD_NUTRIENT_LABELS.fibre, value: grams(food.fibre_g) },
];
