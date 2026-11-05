import { GOAL_QUESTION_STEPS } from "@keylow/core/copy";

import type { GoalQuestionStep } from "@keylow/core/copy";

/** The goal questionnaire. Its address opens the first question. */
export const goalPath = (): string => "/goal";

/**
 * Where the Goal row of More leads. It is the flow for now, filled with the goal when one is stored. The
 * Goal page that shows a stored goal's answers will point this at that page when a goal exists.
 */
export const goalRowPath = (): string => goalPath();

/**
 * Where the flow leaves to, when it is closed or its goal is saved: the More page, which holds the Goal row
 * that opens it.
 */
export const goalExitPath = (): string => "/more";

/** One question of the six, by its number from 1 to 6. */
export const goalQuestionPath = (step: number): string => `${goalPath()}/${step}`;

/** The summary the last question leads to. Its folder sits beside the questions', so it is never taken for one. */
export const goalSummaryPath = (): string => `${goalPath()}/summary`;

/** The question an address names: its number from 1 to 6 as written, or `undefined` for anything else. */
export function readGoalStep(segment: string): GoalQuestionStep | undefined {
  return GOAL_QUESTION_STEPS.find((_step, index) => String(index + 1) === segment);
}
