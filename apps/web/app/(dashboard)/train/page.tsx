import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { TrainRoute } from "@/components/train";

// The top bar's Train link opens this page, and it stays current on the pages under it.
export default function TrainPage() {
  return (
    <PageFrame variant="diary">
      <TrainRoute />
    </PageFrame>
  );
}
