import type { FoodFormValues, NutrientFieldName } from "../FoodForm";

export type NewFoodFormProps = {
  initialValues: FoodFormValues;
  isBarcodeLocked: boolean;
  lockedBarcodeHint?: string;
  nutrientNote?: string;
  /** The nutrients a copied food's source left out, which the form cues as not given while they are blank. */
  notGivenNutrients?: readonly NutrientFieldName[];
  submitLabel: string;
};
