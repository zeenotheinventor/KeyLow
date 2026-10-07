/** The symbology names the camera reports (expo-camera barcode types). */
export type BarcodeSymbology = "ean13" | "ean8" | "upc_a" | "upc_e";

export type BarcodeInvalidReason = "not_digits" | "bad_length" | "bad_check_digit" | "not_upc_e";

export type NormaliseBarcodeResult =
  { ok: true; code: string } | { ok: false; reason: BarcodeInvalidReason };

const NON_DIGIT = /[^0-9]/;
const SEPARATORS = /[\s-]/g;

/** A GTIN is valid when its last digit tops the weighted sum of the rest (weights 3, 1 from the right) up to a multiple of 10. */
function hasValidCheckDigit(digits: string): boolean {
  const bodyLength = digits.length - 1;
  let weightedSum = 0;
  for (let position = 0; position < bodyLength; position += 1) {
    const digit = Number(digits.charAt(bodyLength - 1 - position));
    weightedSum += digit * (position % 2 === 0 ? 3 : 1);
  }
  return (10 - (weightedSum % 10)) % 10 === Number(digits.charAt(bodyLength));
}

/** Expands a UPC-E code (number system digit, six digits, check digit) to its 12-digit UPC-A form. */
function expandUpcE(upcE: string): string {
  const numberSystem = upcE.slice(0, 1);
  const sixDigits = upcE.slice(1, 7);
  const checkDigit = upcE.slice(7);
  const lastDigit = sixDigits.slice(5);

  switch (lastDigit) {
    case "0":
    case "1":
    case "2":
      return `${numberSystem}${sixDigits.slice(0, 2)}${lastDigit}0000${sixDigits.slice(2, 5)}${checkDigit}`;
    case "3":
      return `${numberSystem}${sixDigits.slice(0, 3)}00000${sixDigits.slice(3, 5)}${checkDigit}`;
    case "4":
      return `${numberSystem}${sixDigits.slice(0, 4)}00000${sixDigits.slice(4, 5)}${checkDigit}`;
    default:
      return `${numberSystem}${sixDigits.slice(0, 5)}0000${lastDigit}${checkDigit}`;
  }
}

/** Keeps `code` when the check digit of `digits` validates, otherwise reports the bad check digit. */
function codeIfCheckDigitValid(digits: string, code: string): NormaliseBarcodeResult {
  return hasValidCheckDigit(digits) ? { ok: true, code } : { ok: false, reason: "bad_check_digit" };
}

function normaliseEan8(digits: string): NormaliseBarcodeResult {
  return codeIfCheckDigitValid(digits, digits);
}

function normaliseUpcE(digits: string): NormaliseBarcodeResult {
  if (!digits.startsWith("0") && !digits.startsWith("1")) {
    return { ok: false, reason: "not_upc_e" };
  }
  const upcA = expandUpcE(digits);
  return codeIfCheckDigitValid(upcA, `0${upcA}`);
}

function normaliseEightDigits(
  digits: string,
  symbology?: BarcodeSymbology,
): NormaliseBarcodeResult {
  if (symbology === "ean8") {
    return normaliseEan8(digits);
  }
  if (symbology === "upc_e") {
    return normaliseUpcE(digits);
  }
  const asEan8 = normaliseEan8(digits);
  if (asEan8.ok) {
    return asEan8;
  }
  const asUpcE = normaliseUpcE(digits);
  return asUpcE.ok ? asUpcE : { ok: false, reason: "bad_check_digit" };
}

/**
 * Reduces a scanned or typed barcode to its canonical stored form (ADR 0003, Amendment 1):
 * 8 digits (EAN-8), 13 digits (EAN-13, with UPC-A and UPC-E padded or expanded to it)
 * or 14 digits (GTIN-14 with a non-zero indicator). The symbology hint only matters at 8 digits,
 * where it decides between EAN-8 and UPC-E with no fallback to the other reading.
 * An `ean13` or `upc_a` hint on an 8-digit code names neither reading, so it is treated as no
 * hint (EAN-8 is tried first, then UPC-E). A UPC-E ending in 5 to 9 is always also a valid EAN-8,
 * so without a hint it reads as EAN-8. That follows from the ADR rule and is pinned by a test.
 */
export function normaliseBarcode(
  raw: string,
  symbology?: BarcodeSymbology,
): NormaliseBarcodeResult {
  const digits = raw.replace(SEPARATORS, "");
  if (NON_DIGIT.test(digits)) {
    return { ok: false, reason: "not_digits" };
  }

  switch (digits.length) {
    case 8:
      return normaliseEightDigits(digits, symbology);
    case 12:
      return codeIfCheckDigitValid(digits, `0${digits}`);
    case 13:
      return codeIfCheckDigitValid(digits, digits);
    case 14:
      // Indicator 0 is the same product as its 13-digit EAN, any other indicator is a distinct GTIN-14.
      return codeIfCheckDigitValid(digits, digits.startsWith("0") ? digits.slice(1) : digits);
    default:
      return { ok: false, reason: "bad_length" };
  }
}
