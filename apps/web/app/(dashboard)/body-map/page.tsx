import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { BodyMapScreen } from "@/components/body";

// The dashboard's body map card opens this page. The top bar marks no section as current here, since Train
// is current only under /train and the body map is not under it.
export default function BodyMapPage() {
  return (
    <PageFrame variant="diary">
      <BodyMapScreen />
    </PageFrame>
  );
}
