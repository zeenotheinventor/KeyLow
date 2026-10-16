import type { UseFoodByBarcodeReturn } from "@keylow/api-client";

/** What the lookup of a valid barcode has come to so far, as `useFoodByBarcode` reports it. */
export type BarcodeResultProps = UseFoodByBarcodeReturn & {
  /** The day to carry to the form that creates a food for a code that was not found. */
  day?: string | undefined;
};
