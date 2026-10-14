import { PLACEHOLDER_BODIES, TAB_TITLES } from "@keylow/core/copy";

import { PlaceholderScreen } from "../../components/PlaceholderScreen";

export default function DashboardRoute() {
  return (
    <PlaceholderScreen
      body={PLACEHOLDER_BODIES.dashboard}
      icon="LayoutDashboard"
      title={TAB_TITLES.dashboard}
    />
  );
}
