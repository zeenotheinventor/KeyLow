import { GOAL_QUESTION_STEPS } from "@keylow/core/copy";
import { Redirect, useLocalSearchParams } from "expo-router";

import {
  firstUnansweredStep,
  GoalQuestionScreen,
  useGoalDraft,
} from "../../components/GoalQuestionnaire";
import { goalQuestionPath, readGoalStep } from "../../lib/goalRoutes";

// A question's address ends in its number. Anything that is not one of the six opens the first question, and
// so does a question reached while an earlier one is still open: the person is sent to that earlier one.
// Every question on screen therefore has the question before it under it, for Back to return to.
export default function GoalQuestionRoute() {
  const { step } = useLocalSearchParams<{ step?: string | string[] }>();
  const { draft } = useGoalDraft();
  const question = readGoalStep(step);

  if (question === undefined) {
    return <Redirect href={goalQuestionPath(1)} />;
  }

  const firstOpen = firstUnansweredStep(draft, GOAL_QUESTION_STEPS.indexOf(question) + 1);

  return firstOpen === undefined ? (
    <GoalQuestionScreen step={question} />
  ) : (
    <Redirect href={goalQuestionPath(firstOpen)} />
  );
}
