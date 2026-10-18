import { goalAnswersSchema } from "./goalAnswers";

import type { GoalAnswers } from "./goalAnswers";

/**
 * The answers as the questionnaire rules read them, or a `RangeError` stating the first rule they break.
 * The message never quotes a value, because a goal answer is health data and must not reach a log.
 */
export const parseGoalAnswers = (answers: GoalAnswers): GoalAnswers => {
  const result = goalAnswersSchema.safeParse(answers);
  if (!result.success) {
    throw new RangeError(result.error.issues[0]?.message ?? "The goal answers are not valid");
  }
  return result.data;
};
