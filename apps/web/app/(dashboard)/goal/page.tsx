import { GoalRoute } from "@/components/goals";

// The flow's own address: the Goal page when a goal is stored, and the first question when none is. The
// layout above has waited for a running read, so GoalRoute knows by now. Train opens it with `from=train`.
export default async function GoalPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;

  return <GoalRoute from={typeof from === "string" ? from : undefined} />;
}
