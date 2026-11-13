import type { GoalQuestionStep } from "@keylow/core/copy";

export type GoalQuestionScreenProps = {
  /** Which of the six questions to ask. */
  step: GoalQuestionStep;
  /** Whether a row of the Goal page opened this question, or Next from one that it opened. Its address says so. */
  isFromGoalPage: boolean;
  /** Whether Train opened the flow. Its address says so. */
  isFromTrain: boolean;
};
