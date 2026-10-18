import { BODY_MAP } from "@keylow/core/copy";
import { View } from "react-native";

import { Skeleton } from "../../ui";

/**
 * What the body map card shows while it loads, after the 200 ms the skeleton waits. It loads on its own, so
 * the cards above it are already there when it is the slow one. The skeleton is hidden from screen readers,
 * so the status around it says what is loading.
 */
export function DashboardBodyMapLoading() {
  return (
    <View accessible aria-label={BODY_MAP.dashboardCard.loadingLabel} role="status">
      <Skeleton variant="bodyMapCard" />
    </View>
  );
}
