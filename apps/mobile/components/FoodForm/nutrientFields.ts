import type { FoodFormValues } from "./types";

export type NutrientFieldName = "kcal" | "protein_g" | "fat_g" | "carbs_g" | "fibre_g";

type NutrientField = {
  name: NutrientFieldName;
  label: string;
  /** The name used at the start of an error message, so it reads as a sentence. */
  subject: string;
};

export const NUTRIENT_FIELDS: readonly NutrientField[] = [
  { name: "kcal", label: "Energy (kcal)", subject: "Energy (kcal)" },
  { name: "protein_g", label: "Protein (g)", subject: "Protein" },
  { name: "fat_g", label: "Fat (g)", subject: "Fat" },
  { name: "carbs_g", label: "Carbohydrate (g)", subject: "Carbohydrate" },
  { name: "fibre_g", label: "Fibre (g)", subject: "Fibre" },
];

export function isNutrientFieldName(name: unknown): name is NutrientFieldName {
  return NUTRIENT_FIELDS.some((field) => field.name === name);
}

export type TextFieldName = keyof Pick<
  FoodFormValues,
  "name" | "brand" | "barcode" | NutrientFieldName
>;
