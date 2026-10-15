import type { FoodFormValues, NutrientFieldName } from "../FoodForm";
import type { Food } from "@keylow/core/schemas";

export type NewFoodFormProps = {
  initialValues: FoodFormValues;
  isBarcodeLocked: boolean;
  lockedBarcodeHint?: string;
  nutrientNote?: string;
  /** The nutrients a copied food's source left out, which the form cues as not given while they are blank. */
  notGivenNutrients?: readonly NutrientFieldName[];
  submitLabel: string;
  /** The food being copied. Its saturated fat, sugars and salt are carried onto the new food, unseen. */
  copiedFrom?: Food;
};
