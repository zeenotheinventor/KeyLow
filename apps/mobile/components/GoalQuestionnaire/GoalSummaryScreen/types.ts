import type { GoalAnswers } from "@keylow/core/training";

export type GoalSummaryScreenProps = {
  /** The complete answers the questionnaire holds. Save goal sends exactly these. */
  answers: GoalAnswers;
};
