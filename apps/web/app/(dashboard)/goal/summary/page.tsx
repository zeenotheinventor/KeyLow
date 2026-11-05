import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { GoalSummaryRoute } from "@/components/goals";

// The summary's own address, which the last question leads to. A folder of its own beside the question
// route, so "summary" is never taken for a question. There is no link to it until the last three questions
// are built.
export default function GoalSummaryPage() {
  return (
    <PageFrame variant="diary">
      <GoalSummaryRoute />
    </PageFrame>
  );
}
