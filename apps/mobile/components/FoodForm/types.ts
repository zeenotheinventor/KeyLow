import type { NutrientFieldName } from "./nutrientFields";
import type { FoodFormFields, PortionFormFields } from "@keylow/core/foods";
import type { CustomFoodInput } from "@keylow/core/schemas";

/** One portion as the form holds it. The amount stays text until the form is validated. */
export type PortionFormValues = PortionFormFields;

/**
 * Everything the form edits, as the text the user typed: core's form fields, plus what the form
 * carries through without showing.
 */
export type FoodFormValues = FoodFormFields & {
  /** Not shown or edited here, carried through so that saving an edit does not clear it. */
  densityGramsPerMillilitre?: number;
  portions: PortionFormValues[];
};

export type FoodFormProps = {
  submitLabel: string;
  initialValues?: FoodFormValues;
  /** Locks the barcode field, used when the barcode came from a scan. */
  isBarcodeLocked?: boolean;
  /** Says where a locked barcode came from. Defaults to the wording for a scanned barcode. */
  lockedBarcodeHint?: string;
  /** A sentence shown above the nutrient fields, for something the user should know before filling them. */
  nutrientNote?: string;
  /**
   * The nutrients a copied food's source left out. Each is cued as not given for as long as it is blank, and
   * the cue gives way to the error when a save is tried with it still blank.
   */
  notGivenNutrients?: readonly NutrientFieldName[];
  /** Receives the validated input. A rejection is shown to the user as the reason the save failed. */
  onSubmit: (input: CustomFoodInput) => Promise<void>;
};

/** What the form says above Save when a save fails: a title, one sentence and which notice draws it. */
export type SaveNotice = {
  variant: "error" | "review";
  title: string;
  body: string;
};
