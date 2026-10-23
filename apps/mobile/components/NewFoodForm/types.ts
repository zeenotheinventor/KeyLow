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
  /** The scan this form was opened from, when it was. Where a saved food continues depends on what began the scan. */
  fromScan?: { barcode: string; continueTo: ScanContinuation };
};

/**
 * Where the food saved from a scan continues. In the diary it opens the new food's portion picker, with the
 * scanned code and the day and time the scan began on, instead of the food's page. In the recipe editor
 * it goes back to the editor that asked for the scan, which opens the amount step for the food, and the
 * sheet closes.
 */
export type ScanContinuation =
  { kind: "log"; logContext: LogContext | undefined } | { kind: "ingredient"; requestId: string };
