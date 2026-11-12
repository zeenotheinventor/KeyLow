import { GoalSummaryRoute } from "@/components/goals";

// The summary's own address, which the last question leads to. A folder of its own beside the question
// route, so "summary" is never taken for a question.
export default function GoalSummaryPage() {
  return <GoalSummaryRoute />;
}
