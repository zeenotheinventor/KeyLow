import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { RoutinesScreen } from "@/components/train/RoutinesScreen";

// The routines list opens from the Train home once the editor adds its link, and Train stays current in the top bar on it.
export default function TrainRoutinesPage() {
  return (
    <PageFrame variant="diary">
      <RoutinesScreen />
    </PageFrame>
  );
}
