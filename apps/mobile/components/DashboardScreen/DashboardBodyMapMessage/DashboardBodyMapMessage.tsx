import { BODY_MAP } from "@keylow/core/copy";
import { View } from "react-native";

import { Card, Icon, Text } from "../../ui";

import type { DashboardBodyMapMessageProps } from "./types";

const TITLE_ICON_SIZE = 14;

/**
 * The body map card when it has nothing to show: its title over one quiet line, either that a read failed
 * or that the body map is not available offline. There is no Try again, because the card reads again by
 * itself and the Dashboard's own error state is where a failed read is retried. It is not pressable,
 * because a read that failed or a phone with nothing saved has no body map to open.
 */
export function DashboardBodyMapMessage({ kind }: DashboardBodyMapMessageProps) {
  return (
    <Card padding={0}>
      <View className="gap-2 py-3 pl-4 pr-3">
        <View className="flex-row items-center gap-[6px]">
          <Icon name="Dumbbell" size={TITLE_ICON_SIZE} tone="secondary" />
          <Text tone="muted" variant="caption">
            {BODY_MAP.dashboardCard.title}
          </Text>
        </View>
        <Text tone="secondary">
          {kind === "failed"
            ? BODY_MAP.dashboardCard.loadFailed
            : BODY_MAP.dashboardCard.offlineUnavailable}
        </Text>
      </View>
    </Card>
  );
}
