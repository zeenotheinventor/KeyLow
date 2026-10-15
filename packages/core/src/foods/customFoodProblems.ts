import { normaliseBarcode } from "./barcode";
import { REQUIRED_FOOD_NUTRIENTS } from "./foodForm";

import type { BarcodeInvalidReason } from "./barcode";
import type { FoodFormFieldsWithPortions } from "./foodForm";

/** The nutrients a food form has, in the order the forms draw them. Fibre may be left blank. */
export const FORM_NUTRIENTS = [...REQUIRED_FOOD_NUTRIENTS, "fibre_g"] as const;

export type FormNutrient = (typeof FORM_NUTRIENTS)[number];

/** The part of a zod issue that is read: what failed, and where. */
export type CustomFoodIssue = { code: string; path: readonly PropertyKey[] };

/** The form values the issues came from, which tell a blank nutrient from a mistyped one. */
export type ClassifiableValues = Pick<FoodFormFieldsWithPortions, "barcode" | FormNutrient> & {
  portions: readonly unknown[];
};

/**
 * What is wrong, without the words for it. A portion is found by its place in the list, from 0. An
 * amount problem covers a missing, mistyped or non-positive amount. A `form` problem is an issue
 * that no field of the form can show.
 */
export type CustomFoodProblem =
  | { target: "name"; rule: "required" | "too_long" }
  | { target: "brand" }
  | { target: "barcode"; rule: BarcodeInvalidReason | "not_valid" }
  | { target: "nutrient"; nutrient: FormNutrient; rule: "required" | "not_a_number" | "negative" }
  | { target: "portion"; index: number; field: "label" | "amount" }
  | { target: "portions" }
  | { target: "form" };

const isFormNutrient = (key: unknown): key is FormNutrient =>
  FORM_NUTRIENTS.some((nutrient) => nutrient === key);

function classifyBarcode(barcode: string): CustomFoodProblem {
  const result = normaliseBarcode(barcode.trim());
  return { target: "barcode", rule: result.ok ? "not_valid" : result.reason };
}

function classifyNutrient(
  nutrient: FormNutrient,
  issue: CustomFoodIssue,
  values: ClassifiableValues,
): CustomFoodProblem {
  if (issue.code === "too_small") {
    return { target: "nutrient", nutrient, rule: "negative" };
  }
  const isBlank = values[nutrient].trim() === "";
  return { target: "nutrient", nutrient, rule: isBlank ? "required" : "not_a_number" };
}

function classifyIssue(issue: CustomFoodIssue, values: ClassifiableValues): CustomFoodProblem {
  const [head, index, field] = issue.path;

  if (head === "name") {
    return { target: "name", rule: issue.code === "too_big" ? "too_long" : "required" };
  }
  if (head === "brand") {
    return { target: "brand" };
  }
  if (head === "barcode") {
    return classifyBarcode(values.barcode);
  }
  if (isFormNutrient(head)) {
    return classifyNutrient(head, issue, values);
  }
  if (head === "portions" && index === undefined) {
    return { target: "portions" };
  }
  if (
    head === "portions" &&
    typeof index === "number" &&
    Number.isInteger(index) &&
    index >= 0 &&
    index < values.portions.length
  ) {
    // A missing amount fails the one-of-grams-or-ml rule on the portion itself, so any issue below the label is its amount.
    return { target: "portion", index, field: field === "label" ? "label" : "amount" };
  }
  return { target: "form" };
}

/**
 * Sorts the issues the custom food schema found into problems a form can place, one for each issue
 * and in the same order, so that none is dropped. The values give the context an issue lacks: the
 * barcode as typed, and whether a nutrient was blank or mistyped. A form puts its own words to each.
 */
export function classifyCustomFoodIssues(
  issues: readonly CustomFoodIssue[],
  values: ClassifiableValues,
): CustomFoodProblem[] {
  return issues.map((issue) => classifyIssue(issue, values));
}
