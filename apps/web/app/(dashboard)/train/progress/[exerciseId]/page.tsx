import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { ExerciseProgressScreen } from "@/components/train";

// An exercise's row in the Progress section of Routines opens this page, and Train stays current in the top
// bar on it. The address carries the exercise's id and never its name.
export default async function TrainExerciseProgressPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = await params;

  return (
    <PageFrame variant="diary">
      <ExerciseProgressScreen exerciseId={exerciseId} />
    </PageFrame>
  );
}
