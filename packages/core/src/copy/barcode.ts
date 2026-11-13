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

/** The scan screen's own lines: its header, the viewfinder's name, the hint under the camera and the card that shows the code. */
export const BARCODE_SCAN = {
  title: "Scan barcode",
  backLabel: "Back to search",
  closeLabel: "Close",
  viewfinderLabel: "Barcode viewfinder",
  hint: "Point the camera at a food barcode",
  barcodeReadLabel: "Barcode read",
  scanAgain: "Scan again",
};

/** The two screens that stand in for the camera: before it was asked for, and once the system will not ask again. */
export const CAMERA_PERMISSION = {
  ask: {
    title: "Camera access",
    body: "Ki-Lo uses the camera to scan food barcodes so you can look up a product without typing.",
    action: "Allow camera",
  },
  denied: {
    title: "Camera access is off",
    body: "Ki-Lo cannot scan barcodes without the camera. Open the settings, allow camera access for Ki-Lo, then come back to scan.",
    action: "Open settings",
  },
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

/**
 * The typed lookup inside the recipe's Add ingredient dialog. The recipe is unsaved, so a code nobody has
 * is turned into a food in another tab and the person comes back to search for it. Offline there is no lookup.
 */
export const INGREDIENT_BARCODE = {
  offline: "Looking up a barcode needs a connection.",
  notFoundBody:
    "Create the food with this barcode in a new tab, then search for it here. Your recipe stays as it is.",
  notFoundAction: "Create food with this barcode (opens in a new tab)",
};

/** The same lookup inside the Add food dialog, where the plate is held and must not be lost. */
export const PLATE_BARCODE = {
  notFoundBody:
    "Create the food with this barcode in a new tab, then search for it here. Your plate stays as it is.",
};

export const BARCODE_LOOKUP_PROGRESS = {
  lookingUp: "Looking up the barcode",
  openingFood: "Opening the food",
};

export const BARCODE_LOOKUP_FAILED = {
  title: "Lookup failed",
  body: "The barcode could not be looked up. Check your connection and try again.",
};

/** The title of the notice shown when a barcode lookup is rate limited. The body is `describeRateLimit`. */
export const LOOKUP_RATE_LIMITED = "Too many lookups just now";
