import { GoalSummaryRoute } from "@/components/goals";

// The summary's own address, which the last question leads to. A folder of its own beside the question
// route, so "summary" is never taken for a question. A flow Train opened carries `origin=train`.
export default async function GoalSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ origin?: string | string[] }>;
}) {
  const { origin } = await searchParams;

  return <GoalSummaryRoute origin={typeof origin === "string" ? origin : undefined} />;
}
