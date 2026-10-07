import type { BarcodeInvalidReason } from "@keylow/core/foods";

/** What to tell the user, in plain words, when `normaliseBarcode` rejects a code. */
export const BARCODE_MESSAGES: Record<BarcodeInvalidReason, string> = {
  not_digits: "Use digits only",
  bad_length: "Use 8, 12, 13 or 14 digits",
  bad_check_digit: "The check digit is wrong, so check the digits and try again",
  not_upc_e: "That is not a valid 8 digit barcode",
};
