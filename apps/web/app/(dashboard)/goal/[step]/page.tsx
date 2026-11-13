import { GoalQuestionRoute } from "@/components/goals";

// A question a row of the Goal page opens carries `from=goal`, which tells its Back where to return to. One
// opened from Train carries `origin=train`, which tells a cancel where to leave for.
export default async function GoalQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<{ from?: string | string[]; origin?: string | string[] }>;
}) {
  const { step } = await params;
  const { from, origin } = await searchParams;

  return (
    <GoalQuestionRoute
      step={step}
      from={typeof from === "string" ? from : undefined}
      origin={typeof origin === "string" ? origin : undefined}
    />
  );
}
