import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { RoutineEditorScreen } from "@/components/train/RoutineEditorScreen";

// A routine on the routines page opens this page, and Train stays current in the top bar on it.
export default async function EditRoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PageFrame variant="diary">
      <RoutineEditorScreen id={id} />
    </PageFrame>
  );
}
