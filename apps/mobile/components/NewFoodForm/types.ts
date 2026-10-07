import type { FoodFormValues } from "../FoodForm";

export type NewFoodFormProps = {
  initialValues: FoodFormValues;
  isBarcodeLocked: boolean;
  lockedBarcodeHint?: string;
  nutrientNote?: string;
  submitLabel: string;
};
