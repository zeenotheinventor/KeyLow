import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { TrainRoute } from "@/components/train";

// The top bar does not link here yet: the finish ticket adds the Train link, since a page that starts a
// session you cannot finish would be broken.
export default function TrainPage() {
  return (
    <PageFrame variant="diary">
      <TrainRoute />
    </PageFrame>
  );
}
