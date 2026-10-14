import { LayoutDashboard } from "lucide-react";

import { ComingSoon } from "../ComingSoon";

export default function DashboardPage() {
  return (
    <ComingSoon
      title="Dashboard"
      icon={LayoutDashboard}
      body="Your weekly nutrition, weight trend and expenditure will appear here."
    />
  );
}
