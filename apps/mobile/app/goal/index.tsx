import { useTrainingGoals } from "@keylow/api-client";
import { Redirect } from "expo-router";

import { GoalScreen } from "../../components/GoalQuestionnaire";
import { goalQuestionPath } from "../../lib/goalRoutes";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

// The flow's own address: the Goal screen when a goal is stored, and the first question when none is. The
// layout above has waited for a running read, so the goal is known by now, or cannot be: a read paused
// because the phone is offline, one that failed, and one not allowed yet are not waited for, and they open
// the questions, empty, as the layout's provider does. Nothing here is blank, and no wrong screen shows first.
export default function GoalIndex() {
  const goals = useTrainingGoals({ enabled: useReadsEnabled() });

  if (goals.data === undefined || goals.data === null) {
    return <Redirect href={goalQuestionPath(1)} />;
  }

  return <GoalScreen goal={goals.data} />;
}
