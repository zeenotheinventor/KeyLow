import { View } from "react-native";

import { Icon, Text } from "../../../ui";

import type { SummaryLineProps } from "./types";

/**
 * One line of the check-in summary, as the canvas's `Summary line`, `Guardrail line` and `Reason line` draw them: a
 * 16 point icon before the caption, which is a check for the data line, an info mark for a guardrail and an alert
 * in the warning ink for a reason. A plain line has no icon and is indented by the icon's width.
 */
export function SummaryLine({ kind, text }: SummaryLineProps) {
  return (
    <View className="flex-row items-start gap-2">
      {kind === "data" ? <Icon name="CircleCheck" size={16} tone="secondary" /> : null}
      {kind === "guardrail" ? <Icon name="Info" size={16} tone="secondary" /> : null}
      {kind === "reason" ? <Icon name="CircleAlert" size={16} tone="warning-ink" /> : null}
      {kind === "plain" ? <View className="w-4" /> : null}
      <Text className="min-w-0 flex-1 tabular-nums" tone="secondary" variant="caption">
        {text}
      </Text>
    </View>
  );
}
