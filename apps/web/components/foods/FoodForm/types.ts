import type { CustomFoodValidationError } from "@keylow/api-client";
import type { Food, FoodPortion, NutrientBasis } from "@keylow/core/schemas";

/** A food already saved by the user, with its portions, which the form edits instead of creating. */
export type FoodFormExistingFood = { food: Food; portions: FoodPortion[] };

export type FoodFormProps = {
  /** A barcode that came from a scan. It pre-fills the barcode field and cannot be changed. */
  scannedBarcode?: string | undefined;
  existing?: FoodFormExistingFood;
};

/** One portion as the form holds it. The amount is text until the form is validated. */
export type PortionFormValues = {
  key: string;
  label: string;
  amount: string;
  isDefault: boolean;
};

/** Every number is text while the user types, and only becomes a number when the form is validated. */
export type FoodFormValues = {
  name: string;
  brand: string;
  barcode: string;
  basis: NutrientBasis;
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
  fibre: string;
  portions: PortionFormValues[];
};

/** Error messages by field, keyed by the dotted path of the field in the validated input. */
export type FieldErrors = Partial<Record<string, string>>;

export type FormIssue = CustomFoodValidationError["issues"][number];
