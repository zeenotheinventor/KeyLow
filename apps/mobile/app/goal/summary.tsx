import { goalAnswersSchema } from "@keylow/core/training";
import { Redirect } from "expo-router";
import { useMemo } from "react";

import {
  firstUnansweredStep,
  GoalSummaryScreen,
  useGoalDraft,
} from "../../components/GoalQuestionnaire";
import { goalQuestionPath } from "../../lib/goalRoutes";

// The summary's own address, which the last question leads to. It is a file of its own, or the question route
// would take "summary" for a question and send it to the first. It reads the answers the flow holds, and with
// any question still open it sends the person to that question, so a goal that is not complete is never shown
// and never saved.
export default function GoalSummaryRoute() {
  const { draft } = useGoalDraft();
  const parsed = useMemo(() => goalAnswersSchema.safeParse(draft), [draft]);

  if (!parsed.success) {
    return <Redirect href={goalQuestionPath(firstUnansweredStep(draft, 7) ?? 1)} />;
  }

  return <GoalSummaryScreen answers={parsed.data} />;
}
