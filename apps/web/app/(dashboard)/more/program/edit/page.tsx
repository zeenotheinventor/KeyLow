import { PageFrame } from "@/app/(dashboard)/PageFrame";
import { ProgramEditScreen } from "@/components/program";

// Edit programme is a page under the Programme page, which its actions card opens, and More stays current on it.
export default function ProgramEditPage() {
  return (
    <PageFrame variant="shell">
      <ProgramEditScreen />
    </PageFrame>
  );
}
