import type { Food } from "@keylow/core/schemas";

export type NutrientTableProps = {
  food: Pick<Food, "basis" | "kcal" | "protein_g" | "fat_g" | "carbs_g" | "fibre_g">;
};
