import {
  FOOD_FORM,
  FOOD_FORM_BARCODE_NOT_VALID,
  FOOD_FORM_BARCODE_PROBLEMS,
  describeNameProblem,
  describeNutrientProblem,
  describePortionAmountProblem,
  describePortionLabelProblem,
} from "@keylow/core/copy";
import { normaliseBarcode } from "@keylow/core/foods";

import { isNutrientFieldName } from "./nutrientFields";

import type { NutrientFieldName } from "./nutrientFields";
import type { FoodFormValues } from "./types";
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

function describeBarcodeIssue(barcode: string): string {
  const result = normaliseBarcode(barcode);
  return result.ok ? FOOD_FORM_BARCODE_NOT_VALID : FOOD_FORM_BARCODE_PROBLEMS[result.reason];
}

function describeNutrientIssue(
  nutrient: NutrientFieldName,
  text: string,
  issue: CustomFoodIssue,
): string {
  if (issue.code === "too_small") {
    return describeNutrientProblem(nutrient, "negative");
  }
  return describeNutrientProblem(nutrient, text.trim() === "" ? "required" : "not_a_number");
}

function describePortionIssue(
  position: number,
  portionKey: string,
  field: PropertyKey | undefined,
): [string, string] {
  if (field === "label") {
    return [portionErrorKey(portionKey, "label"), describePortionLabelProblem(position)];
  }
  // A missing amount fails the one-of-grams-or-ml rule on the portion itself, so any issue below the label is its amount.
  return [portionErrorKey(portionKey, "amount"), describePortionAmountProblem(position)];
}

// The sentences all come from core's copy, never from the issue's own message, so no raw error text
// reaches the screen. An issue that maps to no field gets the form's summary sentence.
function describeIssue(
  issue: CustomFoodIssue,
  values: KeyedFoodFormValues,
): [key: string, message: string] {
  const [head, index, field] = issue.path;

  if (head === "name") {
    return ["name", describeNameProblem(issue.code === "too_big" ? "too_long" : "required")];
  }
  if (head === "barcode") {
    return ["barcode", describeBarcodeIssue(values.barcode)];
  }
  if (isNutrientFieldName(head)) {
    return [head, describeNutrientIssue(head, values[head], issue)];
  }
  if (head === "portions" && typeof index === "number") {
    const portion = values.portions[index];
    if (portion !== undefined) {
      return describePortionIssue(index + 1, portion.key, field);
    }
  }
  // The one issue on the portion list as a whole is more than one default.
  if (head === "portions" && index === undefined) {
    return ["portions", FOOD_FORM.onlyOneDefaultPortion];
  }
  return ["form", FOOD_FORM.validationSummary];
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
