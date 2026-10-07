import type { CustomFoodInput, NutrientBasis } from "@keylow/core/schemas";

/** One portion as the form holds it. The amount stays text until the form is validated. */
export type PortionFormValues = {
  label: string;
  amount: string;
  isDefault: boolean;
};

/**
 * Everything the form edits, as the text the user typed. The names of the nutrient fields match the
 * keys of `customFoodInputSchema` so that a validation issue maps straight back to its field.
 */
export type FoodFormValues = {
  name: string;
  brand: string;
  barcode: string;
  basis: NutrientBasis;
  kcal: string;
  protein_g: string;
  fat_g: string;
  carbs_g: string;
  fibre_g: string;
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
  /** Receives the validated input. A rejection is shown to the user as the reason the save failed. */
  onSubmit: (input: CustomFoodInput) => Promise<void>;
};
