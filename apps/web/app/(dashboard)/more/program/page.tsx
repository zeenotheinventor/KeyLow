import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { ProgramScreen } from "@/components/program";

// A row of More's Nutrition section opens this page, and More stays current on it.
export default function ProgramPage() {
  return (
    <PageFrame variant="shell">
      <ProgramScreen />
    </PageFrame>
  );
}
