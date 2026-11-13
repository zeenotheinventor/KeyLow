import type { GoalAnswers } from "@keylow/core/training";

export type GoalSummaryScreenProps = {
  /** The complete answers the questionnaire holds. Save goal sends exactly these. */
  answers: GoalAnswers;
  /** Whether Train opened the flow, which Save goal then returns to. Its address says so. */
  isFromTrain: boolean;
};
