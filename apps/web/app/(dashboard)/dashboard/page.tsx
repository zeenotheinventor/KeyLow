import { LayoutDashboard } from "lucide-react";

import { ComingSoon } from "../ComingSoon";
import { PageFrame } from "../PageFrame";

export default function DashboardPage() {
  return (
    <PageFrame variant="shell">
      <ComingSoon
        title="Dashboard"
        icon={LayoutDashboard}
        body="Your weekly nutrition, weight trend and expenditure will appear here."
      />
    </PageFrame>
  );
}
