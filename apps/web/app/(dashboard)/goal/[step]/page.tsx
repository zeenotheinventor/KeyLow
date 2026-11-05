import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { GoalQuestionRoute } from "@/components/goals";

export default async function GoalQuestionPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;

  return (
    <PageFrame variant="diary">
      <GoalQuestionRoute step={step} />
    </PageFrame>
  );
}
