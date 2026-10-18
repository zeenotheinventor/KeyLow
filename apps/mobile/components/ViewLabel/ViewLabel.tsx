import { View } from "react-native";

import { Text } from "../ui";

import type { ViewLabelProps } from "./types";

/**
 * The line that names the view the body map shows, with the moment it shows beside it. Only the view's name
 * is a polite live region, so a screen reader hears the view named when it changes. The moment ticks with
 * the clock, so it stays outside the region, where TalkBack would announce it again every minute. The dot
 * is decoration.
 */
export function ViewLabel({ label, subLine }: ViewLabelProps) {
  return (
    <View className="gap-[2px]">
      <View accessible aria-live="polite" className="flex-row items-center gap-2" role="status">
        <View aria-hidden className="h-2 w-2 rounded-full bg-text-primary" />
        <Text variant="body-strong">{label}</Text>
      </View>
      <Text tone="muted" variant="caption">
        {subLine}
      </Text>
    </View>
  );
}
