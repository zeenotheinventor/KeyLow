import { GOAL_QUESTION_STEPS } from "@keylow/core/copy";

import type { GoalQuestionStep } from "@keylow/core/copy";

/** The goal questionnaire. Its address opens the first question. */
export const goalPath = (): string => "/goal";

/**
 * Where the flow leaves to, when it is closed or its goal is saved: the More page, which holds the Goal row
 * that opens it.
 */
export const goalExitPath = (): string => "/more";

/** One question of the six, by its number from 1 to 6. */
export const goalQuestionPath = (step: number): string => `${goalPath()}/${step}`;

/** The question an address names: its number from 1 to 6 as written, or `undefined` for anything else. */
export function readGoalStep(segment: string): GoalQuestionStep | undefined {
  return GOAL_QUESTION_STEPS.find((_step, index) => String(index + 1) === segment);
}
