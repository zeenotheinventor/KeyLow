import {
  DASHBOARD_LOAD_FAILED,
  RETRY_LABEL,
  WEEK_CARD,
  describeWeekGridTitle,
  describeWeekStripName,
} from "@keylow/core/copy";
import { View } from "react-native";

import { Button, Card, Text } from "../../ui";

import type { ThisWeekMessageProps } from "./types";

/**
 * The This week card when it has no week to show: its title and the week's Monday, then either an error
 * inside the card with Try again, or the line that the week is not available offline. It is not
 * pressable, because there is nothing in it to open. The Today card above it is unaffected. The error is
 * an alert, with Try again outside the alert's words so it can be reached, as the error state does it.
 */
export function ThisWeekMessage(props: ThisWeekMessageProps) {
  return (
    <Card>
      <View className="gap-3">
        <View className="gap-[2px]">
          <Text role="heading" variant="h2">
            {describeWeekStripName(props.weekStart, true)}
          </Text>
          <Text tone="muted" variant="caption">
            {describeWeekGridTitle(props.weekStart)}
          </Text>
        </View>
        {props.kind === "failed" ? (
          <View className="items-start gap-1">
            <View accessible aria-live="assertive" className="items-start gap-1" role="alert">
              <Text variant="body-strong">{WEEK_CARD.loadFailed}</Text>
              <Text tone="secondary">{DASHBOARD_LOAD_FAILED.body}</Text>
            </View>
            <Button className="mt-2" size="sm" variant="secondary" onPress={props.onRetry}>
              {RETRY_LABEL}
            </Button>
          </View>
        ) : (
          <Text tone="secondary">{WEEK_CARD.offlineUnavailable}</Text>
        )}
      </View>
    </Card>
  );
}
