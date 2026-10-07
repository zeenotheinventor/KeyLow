import { amountUnit } from "./formValues";

import type { FieldErrors, FormIssue } from "./types";
import type { BarcodeInvalidReason } from "@keylow/core/foods";
import type { NutrientBasis } from "@keylow/core/schemas";

const REQUIRED_MESSAGES: Record<string, string> = {
  name: "Enter a name",
  kcal: "Enter the energy in kcal",
  protein_g: "Enter the protein in g",
  fat_g: "Enter the fat in g",
  carbs_g: "Enter the carbohydrate in g",
};

const BARCODE_MESSAGES: Record<BarcodeInvalidReason, string> = {
  not_digits: "Use digits only",
  bad_length: "Use 8, 12, 13 or 14 digits",
  bad_check_digit: "The check digit is wrong, so check the digits and try again",
  not_upc_e: "That is not a valid 8 digit barcode",
};

// The core schema words a rejected barcode as `Invalid barcode: <reason>`.
const BARCODE_MESSAGE_PREFIX = "Invalid barcode: ";

const isBarcodeReason = (reason: string): reason is BarcodeInvalidReason =>
  reason in BARCODE_MESSAGES;

/** The key the form shows an error under: grams and ml are one amount field, a portion's own issue is its amount. */
function fieldKey(path: FormIssue["path"]): string {
  const [first, index, field] = path;

  if (first !== "portions" || index === undefined) {
    return String(first ?? "form");
  }
  if (field === undefined || field === "grams" || field === "ml") {
    return `portions.${String(index)}.amount`;
  }
  return `portions.${String(index)}.${String(field)}`;
}

function requiredMessage(key: string, basis: NutrientBasis): string | undefined {
  if (key.endsWith(".label")) {
    return "Enter a label";
  }
  if (key.endsWith(".amount")) {
    return `Enter an amount in ${amountUnit(basis)}`;
  }
  return REQUIRED_MESSAGES[key];
}

function describeIssue(issue: FormIssue, key: string, basis: NutrientBasis): string {
  switch (issue.code) {
    case "invalid_type":
      return requiredMessage(key, basis) ?? issue.message;
    case "too_small":
      if (issue.origin === "string") {
        return requiredMessage(key, basis) ?? issue.message;
      }
      return issue.inclusive
        ? `Must be ${String(issue.minimum)} or more`
        : `Must be more than ${String(issue.minimum)}`;
    case "too_big":
      return issue.origin === "string"
        ? `Use ${String(issue.maximum)} characters or fewer`
        : issue.message;
    case "custom": {
      if (key === "barcode" && issue.message.startsWith(BARCODE_MESSAGE_PREFIX)) {
        const reason = issue.message.slice(BARCODE_MESSAGE_PREFIX.length);
        return isBarcodeReason(reason) ? BARCODE_MESSAGES[reason] : issue.message;
      }
      return key.endsWith(".amount")
        ? (requiredMessage(key, basis) ?? issue.message)
        : issue.message;
    }
    default:
      return issue.message;
  }
}

/** Maps schema issues to messages by the field they were raised on, keeping the first for each field. */
export function fieldErrorsFrom(issues: FormIssue[], basis: NutrientBasis): FieldErrors {
  const errors: FieldErrors = {};

  for (const issue of issues) {
    const key = fieldKey(issue.path);
    errors[key] ??= describeIssue(issue, key, basis);
  }

  return errors;
}
