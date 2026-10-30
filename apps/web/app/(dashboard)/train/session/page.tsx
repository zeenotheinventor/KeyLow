import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { SessionScreen } from "@/components/train";

// The top bar does not link here yet: the page opens from Start and Resume on the Train home.
export default function TrainSessionPage() {
  return (
    <PageFrame variant="diary">
      <SessionScreen />
    </PageFrame>
  );
}
