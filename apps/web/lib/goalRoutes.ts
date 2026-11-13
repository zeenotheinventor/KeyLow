import { GOAL_QUESTION_STEPS } from "@keylow/core/copy";

import type { GoalQuestionStep } from "@keylow/core/copy";

import { trainPath } from "@/lib/trainRoutes";

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
 * Where the flow leaves to when it is closed or its goal is saved. The web has no stack to read as the phone
 * does, so the address carries where the flow was opened from, and this is the rule. Opened from Train, the
 * flow leaves for Train when the first goal is being set, and for the Goal page as Train opens it when a goal
 * was stored, so the new answers show and Back on that page still returns to Train. Opened from More, it
 * leaves for the Goal page with a stored goal and for More when it is the first goal.
 */
export const goalLeavePath = (hasStoredGoal: boolean, { fromTrain = false } = {}): string => {
  if (hasStoredGoal) {
    return fromTrain ? goalFromTrainPath() : goalPath();
  }
  return fromTrain ? trainPath() : goalExitPath();
};

/**
 * The Goal page as Train opens it. The Goal page reads the `from` parameter to know where its Back button
 * returns to: Train when it says so, and More otherwise. With no goal stored it sends the person to the first
 * question, and the questions and the summary then carry Train in their own `origin` parameter, so a save or
 * a cancel can return to Train.
 */
export const goalFromTrainPath = (): string => `${goalPath()}?from=train`;

// The query a question or the summary carries: `from=goal` when the Goal page is under it, and `origin=train`
// when Train opened the flow. They are two parameters because both can be true of one address.
function originQuery({
  fromGoalPage,
  fromTrain,
}: {
  fromGoalPage: boolean;
  fromTrain: boolean;
}): string {
  const query = new URLSearchParams();
  if (fromGoalPage) {
    query.set("from", "goal");
  }
  if (fromTrain) {
    query.set("origin", "train");
  }
  return query.size === 0 ? "" : `?${query.toString()}`;
}

/** Whether an address, by its `from` or `origin` parameter, says Train opened the flow. */
export const isOpenedFromTrain = (from: string | undefined): boolean => from === "train";

/**
 * One question of the six, by its number from 1 to 6. A question a row of the Goal page opens, and each
 * question Next leads to from it, carries `from=goal`: its address says the Goal page is under it, which is
 * what Back returns to. That is a fact of the address and the history entry that holds it, so it cannot go
 * stale as a flag kept for the whole flow would.
 */
export const goalQuestionPath = (
  step: number,
  { fromGoalPage = false, fromTrain = false } = {},
): string => `${goalPath()}/${step}${originQuery({ fromGoalPage, fromTrain })}`;

/** Whether a question address, by its `from` parameter, was opened from the Goal page. */
export const isOpenedFromGoalPage = (from: string | undefined): boolean => from === "goal";

/** The summary the last question leads to. Its folder sits beside the questions', so it is never taken for one. */
export const goalSummaryPath = ({ fromTrain = false } = {}): string =>
  `${goalPath()}/summary${originQuery({ fromGoalPage: false, fromTrain })}`;

/** The question an address names: its number from 1 to 6 as written, or `undefined` for anything else. */
export function readGoalStep(segment: string): GoalQuestionStep | undefined {
  return GOAL_QUESTION_STEPS.find((_step, index) => String(index + 1) === segment);
}
