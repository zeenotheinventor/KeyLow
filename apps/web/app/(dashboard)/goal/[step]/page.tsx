import { GoalQuestionRoute } from "@/components/goals";

// A question a row of the Goal page opens carries `from=goal`, which tells its Back where to return to.
export default async function GoalQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { step } = await params;
  const { from } = await searchParams;

  return <GoalQuestionRoute step={step} from={typeof from === "string" ? from : undefined} />;
}
