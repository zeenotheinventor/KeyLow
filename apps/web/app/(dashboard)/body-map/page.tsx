import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { BodyMapScreen } from "@/components/body";

// The dashboard's body map card opens this page. The top bar marks no section as current here, since the
// body map belongs to Train, which the bar does not link to yet.
export default function BodyMapPage() {
  return (
    <PageFrame variant="diary">
      <BodyMapScreen />
    </PageFrame>
  );
}
