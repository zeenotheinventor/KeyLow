import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { HistoryScreen } from "@/components/train";

// The History link on the Train home opens this page, and Train stays current in the top bar on it.
export default function TrainHistoryPage() {
  return (
    <PageFrame variant="diary">
      <HistoryScreen />
    </PageFrame>
  );
}
