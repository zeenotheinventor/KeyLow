import {
  describeRateLine,
  SETUP_FLOOR_ABOVE_EXPENDITURE_ADVICE,
  SETUP_GUARDRAIL_LINES,
} from "@keylow/core/copy";
import { bindingCalorieClamp } from "@keylow/core/setup";

import type { EstimateLines } from "./types";
import type { SetupAnswers, StartingPlan } from "@keylow/core/setup";

/**
 * The words under the calorie numeral. The guardrail that set the calories, found by `bindingCalorieClamp`,
 * replaces the rate line with its own, and a macro fit line follows it. The figures are read from the plan
 * and the answers as they are, and the words come from core.
 */
export function describeEstimateLines(answers: SetupAnswers, plan: StartingPlan): EstimateLines {
  const { caloriesKcal, proteinG, fatG } = plan.targets;
  const rate = {
    weightKg: answers.weightKg,
    effectiveRatePctPerWeek: plan.effectiveRatePctPerWeek,
    wantedRatePctPerWeek: answers.ratePctPerWeek,
    unit: answers.weightUnit,
  };
  const macroFitLines = plan.clamps.includes("macro_fit")
    ? [
        SETUP_GUARDRAIL_LINES.macro_fit({
          proteinGrams: proteinG,
          caloriesKcal,
          fatGrams: fatG,
        }),
      ]
    : [];

  switch (bindingCalorieClamp(plan.clamps)) {
    case "floor": {
      const floorLine = SETUP_GUARDRAIL_LINES.floor({
        ...rate,
        caloriesKcal,
        expenditureKcal: plan.estimate.expenditureKcal,
      });
      // A floor above expenditure is a gain, and the line after it tells the person to talk to someone. Core's
      // `describeFloorOutcome` makes the same test for the words before it, so keep the two in step.
      const line =
        plan.effectiveRatePctPerWeek > 0
          ? floorLine
          : `${floorLine} ${SETUP_FLOOR_ABOVE_EXPENDITURE_ADVICE}`;
      return { rateLine: undefined, guardrailLines: [line, ...macroFitLines] };
    }
    case "max_deficit":
      return {
        rateLine: undefined,
        guardrailLines: [SETUP_GUARDRAIL_LINES.max_deficit(rate), ...macroFitLines],
      };
    case "max_surplus":
      return {
        rateLine: undefined,
        guardrailLines: [SETUP_GUARDRAIL_LINES.max_surplus(rate), ...macroFitLines],
      };
    case "profile_max":
      return {
        rateLine: undefined,
        guardrailLines: [
          SETUP_GUARDRAIL_LINES.profile_max({ ...rate, caloriesKcal }),
          ...macroFitLines,
        ],
      };
    case undefined:
      return {
        rateLine: describeRateLine({
          goal: answers.goal,
          ratePctPerWeek: answers.ratePctPerWeek,
          weightKg: answers.weightKg,
          unit: answers.weightUnit,
        }),
        guardrailLines: macroFitLines,
      };
  }
}
