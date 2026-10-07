import type { Food } from "@keylow/core/schemas";

export type NutrientRowField = "kcal" | "protein_g" | "fat_g" | "carbs_g" | "fibre_g";

export type NutrientRow = {
  field: NutrientRowField;
  label: string;
  unit: "kcal" | "g";
};

export type NutrientTableFood = Pick<Food, "basis" | NutrientRowField>;

export type NutrientTableProps = {
  food: NutrientTableFood;
};
