import type { NutrientField } from "./types";

/** The nutrients the schema requires. Fibre is the only one that may be left blank. */
export const REQUIRED_NUTRIENT_FIELDS: readonly NutrientField[] = [
  "kcal",
  "protein",
  "carbs",
  "fat",
];
