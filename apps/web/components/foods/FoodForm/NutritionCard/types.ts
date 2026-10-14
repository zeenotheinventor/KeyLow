import type { FoodFormValues, FormErrors } from "../types";
import type { NutrientBasis } from "@keylow/core/schemas";

export type NutrientField = "kcal" | "protein" | "carbs" | "fat" | "fibre";

export type NutritionCardProps = {
  basis: NutrientBasis;
  values: Pick<FoodFormValues, NutrientField>;
  errors: FormErrors["nutrients"];
  /** The required nutrients that started blank on a copy, because the source did not give them. */
  notGiven: readonly NutrientField[];
  /** Explains why the carbohydrate of a copied food was left blank. */
  hasUsCarbsNote: boolean;
  onBasisChange: (basis: NutrientBasis) => void;
  onChange: (field: NutrientField, value: string) => void;
};
