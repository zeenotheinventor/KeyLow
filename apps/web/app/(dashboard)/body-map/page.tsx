import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { BodyMapScreen } from "@/components/body";

// The dashboard's body map card and the Train page's both open this page. The top bar marks Train as current
// here, as the body map boards draw it.
export default function BodyMapPage() {
  return (
    <PageFrame variant="diary">
      <BodyMapScreen />
    </PageFrame>
  );
}
