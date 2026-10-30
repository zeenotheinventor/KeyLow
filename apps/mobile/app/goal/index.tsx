import { Redirect } from "expo-router";

import { goalQuestionPath } from "../../lib/goalRoutes";

// The flow's own address opens its first question.
export default function GoalIndex() {
  return <Redirect href={goalQuestionPath(1)} />;
}
