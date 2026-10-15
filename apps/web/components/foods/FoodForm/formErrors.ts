import {
  FOOD_FORM_BARCODE_NOT_VALID,
  FOOD_FORM_BARCODE_PROBLEMS,
  describeNameProblem,
  describeNutrientProblem,
  describePortionAmountProblem,
  describePortionLabelAndAmountProblem,
  describePortionLabelProblem,
} from "@keylow/core/copy";
import { normaliseBarcode } from "@keylow/core/foods";

import type { FormErrors, FormIssue, FoodFormValues, PortionError } from "./types";
import type { FoodFormNutrient } from "@keylow/core/copy";

const NUTRIENTS: readonly FoodFormNutrient[] = ["kcal", "protein_g", "fat_g", "carbs_g", "fibre_g"];

const isNutrient = (key: unknown): key is FoodFormNutrient =>
  NUTRIENTS.some((nutrient) => nutrient === key);

function describeBarcodeProblem(barcode: string): string {
  const result = normaliseBarcode(barcode.trim());
  return result.ok ? FOOD_FORM_BARCODE_NOT_VALID : FOOD_FORM_BARCODE_PROBLEMS[result.reason];
}

function describePortionProblem(
  position: number,
  isLabelInvalid: boolean,
  isAmountInvalid: boolean,
): string {
  if (isLabelInvalid && isAmountInvalid) {
    return describePortionLabelAndAmountProblem(position);
  }
  return isLabelInvalid
    ? describePortionLabelProblem(position)
    : describePortionAmountProblem(position);
}

/**
 * Maps the schema's issues to one sentence for each field that failed, from core's form copy. The
 * first issue for a field wins. A portion row gets one sentence however many of its fields failed,
 * and any issue below the label counts against the amount.
 */
export function formErrorsFrom(issues: FormIssue[], values: FoodFormValues): FormErrors {
  const errors: FormErrors = { nutrients: {}, portions: {} };
  const portionIssues = new Map<number, { label: boolean; amount: boolean }>();

  for (const issue of issues) {
    const [head, index, field] = issue.path;

    if (head === "name") {
      errors.name ??= describeNameProblem(issue.code === "too_big" ? "too_long" : "required");
    } else if (head === "barcode") {
      errors.barcode ??= describeBarcodeProblem(values.barcode);
    } else if (isNutrient(head)) {
      const text = values[head];
      const problem =
        issue.code === "too_small" ? "negative" : text.trim() === "" ? "required" : "not_a_number";
      errors.nutrients[head] ??= describeNutrientProblem(head, problem);
    } else if (head === "portions" && typeof index === "number") {
      const problems = portionIssues.get(index) ?? { label: false, amount: false };
      problems[field === "label" ? "label" : "amount"] = true;
      portionIssues.set(index, problems);
    }
  }

  for (const [index, problems] of portionIssues) {
    const error: PortionError = {
      sentence: describePortionProblem(index + 1, problems.label, problems.amount),
      isLabelInvalid: problems.label,
      isAmountInvalid: problems.amount,
    };
    errors.portions[index] = error;
  }

  return errors;
}
