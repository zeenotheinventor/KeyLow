import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { WeightScreen } from "@/components/weight";

// A row of More's Body section opens this page, and More stays current on it.
export default function WeightPage() {
  return (
    <PageFrame variant="shell">
      <WeightScreen />
    </PageFrame>
  );
}
