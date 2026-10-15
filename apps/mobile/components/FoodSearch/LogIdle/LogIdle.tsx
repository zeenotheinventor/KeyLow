import { DIARY_ACTIONS } from "@keylow/core/copy";
import { View } from "react-native";

import { Card, ListRow } from "../../ui";
import { RecentFoods } from "../RecentFoods";

import type { LogIdleProps } from "./types";

/**
 * What the log search shows before anything is typed, as the log search boards draw it: the Quick add row,
 * then Recent. Quick add stays pressable offline, because the form it opens waits for a connection itself.
 */
export function LogIdle({ onQuickAdd, ...recent }: LogIdleProps) {
  return (
    <View className="gap-4">
      <Card padding={0}>
        <ListRow
          icon="Zap"
          subtitle={DIARY_ACTIONS.quickAddCaption}
          title={DIARY_ACTIONS.quickAdd}
          onPress={onQuickAdd}
        />
      </Card>
      <RecentFoods {...recent} />
    </View>
  );
}
