import type { BarcodeInvalidReason } from "@keylow/core/foods";

const INVALID_REASON_MESSAGES: Record<BarcodeInvalidReason, string> = {
  not_digits: "A food barcode is made of digits only, so this one was misread.",
  bad_length: "That code is not the length of a food barcode, so it was misread.",
  bad_check_digit: "The last digit does not match the others, so the barcode was misread.",
  not_upc_e: "That short code is not a valid barcode, so it was misread.",
};

export function describeInvalidReason(reason: BarcodeInvalidReason): string {
  return INVALID_REASON_MESSAGES[reason];
}

export function describeRateLimit(retryAfterSeconds: number | undefined): string {
  if (retryAfterSeconds === undefined) {
    return "Too many lookups just now. Try again in a moment.";
  }
  return `Too many lookups just now. Try again in ${retryAfterSeconds} ${
    retryAfterSeconds === 1 ? "second" : "seconds"
  }.`;
}
