import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { TrainScreen } from "@/components/train";

// The top bar does not link here yet: the page starts no session until the web session pages land.
export default function TrainPage() {
  return (
    <PageFrame variant="diary">
      <TrainScreen />
    </PageFrame>
  );
}
