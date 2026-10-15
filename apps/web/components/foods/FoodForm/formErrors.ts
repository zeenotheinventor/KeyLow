import {
  FOOD_FORM,
  FOOD_FORM_BARCODE_NOT_VALID,
  FOOD_FORM_BARCODE_PROBLEMS,
  describeNameProblem,
  describeNutrientProblem,
  describePortionAmountProblem,
  describePortionLabelAndAmountProblem,
  describePortionLabelProblem,
} from "@keylow/core/copy";
import { classifyCustomFoodIssues } from "@keylow/core/foods";

import type { FormErrors, FormIssue, FoodFormValues, PortionError } from "./types";
import type { CustomFoodProblem } from "@keylow/core/foods";

type BarcodeProblem = Extract<CustomFoodProblem, { target: "barcode" }>;

function describeBarcodeProblem({ rule }: BarcodeProblem): string {
  return rule === "not_valid" ? FOOD_FORM_BARCODE_NOT_VALID : FOOD_FORM_BARCODE_PROBLEMS[rule];
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
 * first issue for a field wins. A portion row gets one sentence however many of its fields failed.
 * No issue goes unsaid: one that no field can show, such as more than one default portion, is a
 * sentence for the banner above the actions.
 */
export function formErrorsFrom(issues: FormIssue[], values: FoodFormValues): FormErrors {
  const errors: FormErrors = { nutrients: {}, portions: {}, bannerSentences: [] };
  const portionIssues = new Map<number, { label: boolean; amount: boolean }>();
  let hasProblemBesidesDefaults = false;
  let hasMoreThanOneDefault = false;

  for (const problem of classifyCustomFoodIssues(issues, values)) {
    if (problem.target === "portions") {
      hasMoreThanOneDefault = true;
      continue;
    }
    hasProblemBesidesDefaults = true;

    if (problem.target === "name") {
      errors.name ??= describeNameProblem(problem.rule);
    } else if (problem.target === "barcode") {
      errors.barcode ??= describeBarcodeProblem(problem);
    } else if (problem.target === "nutrient") {
      errors.nutrients[problem.nutrient] ??= describeNutrientProblem(
        problem.nutrient,
        problem.rule,
      );
    } else if (problem.target === "portion") {
      const problems = portionIssues.get(problem.index) ?? { label: false, amount: false };
      problems[problem.field] = true;
      portionIssues.set(problem.index, problems);
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

  if (hasProblemBesidesDefaults) {
    errors.bannerSentences.push(FOOD_FORM.validationSummary);
  }
  if (hasMoreThanOneDefault) {
    errors.bannerSentences.push(FOOD_FORM.onlyOneDefaultPortion);
  }

  return errors;
}
