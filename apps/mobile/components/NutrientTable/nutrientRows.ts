import type { NutrientRow } from "./types";

export const NUTRIENT_ROWS: readonly NutrientRow[] = [
  { field: "kcal", label: "Energy", unit: "kcal" },
  { field: "protein_g", label: "Protein", unit: "g" },
  { field: "fat_g", label: "Fat", unit: "g" },
  { field: "carbs_g", label: "Carbohydrate", unit: "g" },
  { field: "fibre_g", label: "Fibre", unit: "g" },
];

/** A stored nutrient field name in plain words, for example `carbs_g` as "Carbohydrate". */
export function describeNutrientField(field: string): string {
  return NUTRIENT_ROWS.find((row) => row.field === field)?.label ?? field.replaceAll("_", " ");
}
