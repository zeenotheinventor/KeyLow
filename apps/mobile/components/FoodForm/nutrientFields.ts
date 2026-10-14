import type { FoodFormValues } from "./types";
import type { FoodFormNutrient } from "@keylow/core/copy";

export type NutrientFieldName = FoodFormNutrient;

const NUTRIENT_FIELD_NAMES: readonly NutrientFieldName[] = [
  "kcal",
  "protein_g",
  "carbs_g",
  "fat_g",
  "fibre_g",
];

export function isNutrientFieldName(name: unknown): name is NutrientFieldName {
  return NUTRIENT_FIELD_NAMES.some((fieldName) => fieldName === name);
}

export type TextFieldName = keyof Pick<
  FoodFormValues,
  "name" | "brand" | "barcode" | NutrientFieldName
>;
