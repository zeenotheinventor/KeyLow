import { GOAL_QUESTION_STEPS } from "@keylow/core/copy";

import type { GoalQuestionStep } from "@keylow/core/copy";

/** The goal questionnaire, a full screen pushed over the tabs. Its address opens the first question. */
export const goalPath = (): string => "/goal";

/** One question of the six, by its number from 1 to 6. */
export const goalQuestionPath = (step: number): string => `${goalPath()}/${step}`;

/** The priorities summary the last question leads to. */
export const goalSummaryPath = (): string => `${goalPath()}/summary`;

/**
 * The question an address names: its number from 1 to 6 as written, or `undefined` for anything else. A
 * repeated parameter gives a list, and the first value is read.
 */
export function readGoalStep(
  parameter: string | string[] | undefined,
): GoalQuestionStep | undefined {
  const value = Array.isArray(parameter) ? parameter[0] : parameter;
  return GOAL_QUESTION_STEPS.find((_step, index) => String(index + 1) === value);
}
