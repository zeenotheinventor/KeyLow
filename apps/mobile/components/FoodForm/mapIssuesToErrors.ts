import {
  FOOD_FORM,
  FOOD_FORM_BARCODE_NOT_VALID,
  FOOD_FORM_BARCODE_PROBLEMS,
  describeNameProblem,
  describeNutrientProblem,
  describePortionAmountProblem,
  describePortionLabelProblem,
} from "@keylow/core/copy";
import { classifyCustomFoodIssues } from "@keylow/core/foods";

import type { FoodFormValues } from "./types";
import type { CustomFoodIssue, CustomFoodProblem } from "@keylow/core/foods";

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

// The sentences all come from core's copy, never from the issue's own message, so no raw error text
// reaches the screen. A problem that maps to no field gets the form's summary sentence.
function describeProblem(
  problem: CustomFoodProblem,
  values: KeyedFoodFormValues,
): [key: string, message: string] {
  switch (problem.target) {
    case "name":
      return ["name", describeNameProblem(problem.rule)];
    case "barcode":
      return [
        "barcode",
        problem.rule === "not_valid"
          ? FOOD_FORM_BARCODE_NOT_VALID
          : FOOD_FORM_BARCODE_PROBLEMS[problem.rule],
      ];
    case "nutrient":
      return [problem.nutrient, describeNutrientProblem(problem.nutrient, problem.rule)];
    case "portion": {
      const portion = values.portions[problem.index];
      // The classifier only names a portion that is in the list, this keeps the lookup honest for the compiler.
      if (portion === undefined) {
        return ["form", FOOD_FORM.validationSummary];
      }
      const position = problem.index + 1;
      return problem.field === "label"
        ? [portionErrorKey(portion.key, "label"), describePortionLabelProblem(position)]
        : [portionErrorKey(portion.key, "amount"), describePortionAmountProblem(position)];
    }
    case "portions":
      return ["portions", FOOD_FORM.onlyOneDefaultPortion];
    // The form shows no brand error, so a brand problem gets the summary like any other unplaced one.
    case "brand":
    case "form":
      return ["form", FOOD_FORM.validationSummary];
  }
}

/** Maps validation issues to one message per field. The first issue for a field wins. */
export function mapIssuesToErrors(
  issues: CustomFoodIssue[],
  values: KeyedFoodFormValues,
): FoodFormErrors {
  const errors: FoodFormErrors = {};

  for (const problem of classifyCustomFoodIssues(issues, values)) {
    const [key, message] = describeProblem(problem, values);
    errors[key] ??= message;
  }

  return errors;
}
