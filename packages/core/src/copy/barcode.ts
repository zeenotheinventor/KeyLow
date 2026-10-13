import { describeRateLimit } from "./errors";

import type { BarcodeInvalidReason } from "../foods/barcode";

/** Under the web barcode field, where the user typed the code. A typing mistake, so it says what to check. */
export const TYPED_BARCODE_PROBLEMS: Readonly<Record<BarcodeInvalidReason, string>> = {
  not_digits: "Use digits only",
  bad_length: "Use 8, 12, 13 or 14 digits",
  bad_check_digit: "The check digit is wrong, so check the digits and try again",
  not_upc_e: "That is not a valid 8 digit barcode",
};

/** On the scanner, where the camera read the code. A misread, so it says to scan again. */
export const SCANNED_BARCODE_PROBLEMS: Readonly<Record<BarcodeInvalidReason, string>> = {
  not_digits:
    "A food barcode is made of digits only, so this one was misread. Hold the camera steady and scan again.",
  bad_length:
    "That code is not the length of a food barcode, so it was misread. Hold the camera steady and scan again.",
  bad_check_digit:
    "The last digit does not match the others, so the barcode was misread. Hold the camera steady and scan again.",
  not_upc_e:
    "That short code is not a valid barcode, so it was misread. Hold the camera steady and scan again.",
};

export const BARCODE_NOT_RECOGNISED_TITLE = "Barcode not recognised";

export const BARCODE_NOT_FOUND = {
  title: "Not in Ki-Lo or Open Food Facts",
  /** The body on the scanner, which can scan again. */
  scannedBody: "Create the food with this barcode and it will be found next time you scan it.",
  /** The body on the web, where the code was typed. */
  typedBody: "Create the food with this barcode and it will be found next time.",
  action: "Create food with this barcode",
};

export const BARCODE_LOOKUP_PROGRESS = {
  lookingUp: "Looking up the barcode",
  openingFood: "Opening the food",
};

export const BARCODE_LOOKUP_FAILED = {
  title: "Lookup failed",
  body: "The barcode could not be looked up. Check your connection and try again.",
};

/** The body of the "Open Food Facts is busy" notice on the barcode screens. */
export const describeBarcodeRateLimit = (retryAfterSeconds: number | undefined): string =>
  `Too many lookups just now. ${describeRateLimit(retryAfterSeconds)}`;
