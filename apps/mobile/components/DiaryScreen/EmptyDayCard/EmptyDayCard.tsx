import { DIARY_ACTIONS, EMPTY_DAY } from "@keylow/core/copy";
import { View } from "react-native";

import { Button, Card, Text } from "../../ui";

import type { EmptyDayCardProps } from "./types";

/**
 * The small card above 00:00 on a day with nothing logged: "Nothing logged yet", a hint, and a Copy
 * yesterday button that copies yesterday's whole day. It is dimmed and says so when yesterday is empty too, and dimmed offline.
 */
export function EmptyDayCard({
  isYesterdayEmpty,
  isOnline,
  isCopying,
  onCopyYesterday,
}: EmptyDayCardProps) {
  return (
    <View className="mb-3">
      <Card aria-label={EMPTY_DAY.title}>
        <View className="gap-3">
          <View className="gap-[2px]">
            <Text variant="body-strong">{EMPTY_DAY.title}</Text>
            <Text tone="muted" variant="caption">
              {EMPTY_DAY.mobileHint}
            </Text>
          </View>
          <View className="gap-1">
            <Button
              disabled={isYesterdayEmpty || !isOnline}
              fullWidth
              icon="Copy"
              loading={isCopying}
              variant="secondary"
              onPress={onCopyYesterday}
            >
              {DIARY_ACTIONS.copyYesterday}
            </Button>
            {isYesterdayEmpty ? (
              <Text className="text-center" tone="muted" variant="caption">
                {DIARY_ACTIONS.nothingLoggedYesterday}
              </Text>
            ) : null}
          </View>
        </View>
      </Card>
    </View>
  );
}
