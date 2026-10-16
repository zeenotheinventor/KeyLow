import type { FoodFormValues, NutrientFieldName } from "../FoodForm";
import type { LogContext } from "@keylow/core/diary";
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
  /**
   * The scan this form was opened from, when it was. Saving then opens the new food's portion picker, with the
   * scanned code and the day and time the scan began on, instead of the food's page.
   */
  fromScan?: { barcode: string; logContext: LogContext | undefined };
};
