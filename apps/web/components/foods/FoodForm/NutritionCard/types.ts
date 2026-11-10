import type { FoodFormValues, FormErrors } from "../types";
import type { FoodFormNutrient } from "@keylow/core/copy";
import type { CustomFoodBasis } from "@keylow/core/schemas";

export type NutrientField = FoodFormNutrient;

export type NutritionCardProps = {
  basis: CustomFoodBasis;
  values: Pick<FoodFormValues, NutrientField>;
  errors: FormErrors["nutrients"];
  /** The required nutrients that started blank on a copy, because the source did not give them. */
  notGiven: readonly NutrientField[];
  /** Explains why the carbohydrate of a copied food was left blank. */
  hasUsCarbsNote: boolean;
  onBasisChange: (basis: CustomFoodBasis) => void;
  onChange: (field: NutrientField, value: string) => void;
};
