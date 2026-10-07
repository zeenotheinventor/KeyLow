import { normaliseBarcode } from "@keylow/core/foods";

import { NUTRIENT_FIELDS, isNutrientFieldName } from "./nutrientFields";

import type { FoodFormValues } from "./types";
import type { BarcodeInvalidReason } from "@keylow/core/foods";
import type { customFoodInputSchema } from "@keylow/core/schemas";

type CustomFoodIssue = Extract<
  ReturnType<typeof customFoodInputSchema.safeParse>,
  { success: false }
>["error"]["issues"][number];

/** A portion as the form tracks it: the key identifies its row, so errors survive reordering. */
export type KeyedPortionValues = FoodFormValues["portions"][number] & { key: string };
export type KeyedFoodFormValues = Omit<FoodFormValues, "portions"> & {
  portions: KeyedPortionValues[];
};

/**
 * Error messages by field. A field is keyed by its schema name ("name", "barcode", "kcal", ...), a
 * portion field by `<portion key>.label` or `<portion key>.amount`, the portion list as a whole by
 * "portions", and anything that maps to no field by "form".
 */
export type FoodFormErrors = Partial<Record<string, string>>;

export const portionErrorKey = (portionKey: string, field: "label" | "amount") =>
  `${portionKey}.${field}`;

const BARCODE_MESSAGES: Record<BarcodeInvalidReason, string> = {
  not_digits: "Barcode can only contain digits",
  bad_length: "Barcode must have 8, 12, 13 or 14 digits",
  bad_check_digit: "Barcode check digit is wrong",
  not_upc_e: "Barcode is not a valid product code",
};

function describeBarcodeIssue(barcode: string): string {
  const result = normaliseBarcode(barcode);
  return result.ok ? "Barcode is not valid" : BARCODE_MESSAGES[result.reason];
}

function describeNutrientIssue(subject: string, text: string, issue: CustomFoodIssue): string {
  if (issue.code === "too_small") {
    return `${subject} cannot be negative`;
  }
  return text.trim() === "" ? `${subject} is required` : `${subject} must be a number`;
}

function describePortionIssue(
  position: number,
  portionKey: string,
  field: PropertyKey | undefined,
): [string, string] {
  if (field === "label") {
    return [portionErrorKey(portionKey, "label"), `Portion ${position} needs a label`];
  }
  // A missing amount fails the one-of-grams-or-ml rule on the portion itself, so any issue below the label is its amount.
  return [portionErrorKey(portionKey, "amount"), `Portion ${position} needs an amount above 0`];
}

function describeIssue(
  issue: CustomFoodIssue,
  values: KeyedFoodFormValues,
): [key: string, message: string] {
  const [head, index, field] = issue.path;

  if (head === "name") {
    return [
      "name",
      issue.code === "too_big" ? "Name must be 200 characters or fewer" : "Name is required",
    ];
  }
  if (head === "barcode") {
    return ["barcode", describeBarcodeIssue(values.barcode)];
  }
  if (isNutrientFieldName(head)) {
    const nutrient = NUTRIENT_FIELDS.find((candidate) => candidate.name === head);
    return [head, describeNutrientIssue(nutrient?.subject ?? head, values[head], issue)];
  }
  if (head === "portions" && typeof index === "number") {
    const portion = values.portions[index];
    if (portion !== undefined) {
      return describePortionIssue(index + 1, portion.key, field);
    }
  }
  if (head === "portions") {
    return ["portions", issue.message];
  }
  return ["form", issue.message];
}

/** Maps validation issues to one message per field. The first issue for a field wins. */
export function mapIssuesToErrors(
  issues: CustomFoodIssue[],
  values: KeyedFoodFormValues,
): FoodFormErrors {
  const errors: FoodFormErrors = {};

  for (const issue of issues) {
    const [key, message] = describeIssue(issue, values);
    errors[key] ??= message;
  }

  return errors;
}
