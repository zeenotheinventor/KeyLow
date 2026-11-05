import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { RoutineEditor } from "@/components/train/RoutineEditor";

// New routine on the routines page and Create routine on Train open this page, and Train stays current in the top bar on it.
export default function NewRoutinePage() {
  return (
    <PageFrame variant="diary">
      <RoutineEditor />
    </PageFrame>
  );
}
