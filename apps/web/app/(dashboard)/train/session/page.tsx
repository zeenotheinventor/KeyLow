import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { SessionScreen } from "@/components/train";

// The page opens from Start and Resume on the Train home, and Train stays current in the top bar on it.
export default function TrainSessionPage() {
  return (
    <PageFrame variant="diary">
      <SessionScreen />
    </PageFrame>
  );
}
