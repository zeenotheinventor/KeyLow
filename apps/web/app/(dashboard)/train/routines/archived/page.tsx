import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { ArchivedRoutinesScreen } from "@/components/train/ArchivedRoutinesScreen";

// The archived list opens from the link at the foot of the routines list.
export default function TrainArchivedRoutinesPage() {
  return (
    <PageFrame variant="diary">
      <ArchivedRoutinesScreen />
    </PageFrame>
  );
}
