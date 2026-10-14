import type { FoodFormValues, FormErrors } from "../types";

export type DetailsField = "name" | "brand" | "barcode";

export type DetailsCardProps = {
  values: Pick<FoodFormValues, DetailsField>;
  errors: Pick<FormErrors, "name" | "barcode">;
  /** A barcode that came from a scan or a copy shows as read-only, with a lock. */
  isBarcodeLocked: boolean;
  /** Says where a locked barcode came from. */
  lockedBarcodeNote: string;
  onChange: (field: DetailsField, value: string) => void;
};
