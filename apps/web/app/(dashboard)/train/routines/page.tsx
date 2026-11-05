import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { RoutinesRoute } from "@/components/train/RoutinesRoute";

// The Routines link on the Train home opens this page, and Train stays current in the top bar on it.
export default function TrainRoutinesPage() {
  return (
    <PageFrame variant="diary">
      <RoutinesRoute />
    </PageFrame>
  );
}
