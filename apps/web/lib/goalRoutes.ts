import { GOAL_QUESTION_STEPS } from "@keylow/core/copy";

import type { GoalQuestionStep } from "@keylow/core/copy";

/**
 * The Goal page. With a goal stored it shows the answers, and with none it sends the person to the first
 * question, so the address serves both.
 */
export const goalPath = (): string => "/goal";

/** Where the Goal row of More leads: the Goal page, which opens the first question when there is no goal. */
export const goalRowPath = (): string => goalPath();

/** The More page, which holds the Goal row that opens the flow. */
export const goalExitPath = (): string => "/more";

/**
 * Where the flow leaves to when it is closed or its goal is saved. With a goal that was stored when the flow
 * opened it is the Goal page, where the new answers show and where a row would have opened the question. The
 * web has no stack to read as the phone does, so this is the rule: setting the first goal leaves for More.
 */
export const goalLeavePath = (hasStoredGoal: boolean): string =>
  hasStoredGoal ? goalPath() : goalExitPath();

/**
 * The Goal page as Train opens it. The Goal page reads the `from` parameter to know where its Back button
 * returns to: Train when it says so, and More otherwise. A save or a cancel replaces the address with the plain
 * Goal page, so a person who came from Train leaves for More from there.
 */
export const goalFromTrainPath = (): string => `${goalPath()}?from=train`;

/** Whether a Goal page address, by its `from` parameter, was opened from Train. */
export const isOpenedFromTrain = (from: string | undefined): boolean => from === "train";

/**
 * One question of the six, by its number from 1 to 6. A question a row of the Goal page opens, and each
 * question Next leads to from it, carries `from=goal`: its address says the Goal page is under it, which is
 * what Back returns to. That is a fact of the address and the history entry that holds it, so it cannot go
 * stale as a flag kept for the whole flow would.
 */
export const goalQuestionPath = (step: number, { fromGoalPage = false } = {}): string =>
  `${goalPath()}/${step}${fromGoalPage ? "?from=goal" : ""}`;

/** Whether a question address, by its `from` parameter, was opened from the Goal page. */
export const isOpenedFromGoalPage = (from: string | undefined): boolean => from === "goal";

/** The summary the last question leads to. Its folder sits beside the questions', so it is never taken for one. */
export const goalSummaryPath = (): string => `${goalPath()}/summary`;

/** The question an address names: its number from 1 to 6 as written, or `undefined` for anything else. */
export function readGoalStep(segment: string): GoalQuestionStep | undefined {
  return GOAL_QUESTION_STEPS.find((_step, index) => String(index + 1) === segment);
}
