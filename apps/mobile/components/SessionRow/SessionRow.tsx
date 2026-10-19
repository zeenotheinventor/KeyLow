import { View } from "react-native";

import { Text, useGroupedRowPosition } from "../ui";

import type { SessionRowProps } from "./types";

/**
 * A logged session in the history list, as the `history · list` board draws it: a date block with the
 * weekday over the day, the title, "51 min · 17 sets" and the top muscles. A row in a `GroupedList` has the
 * hairline above it, except the first. It is a plain row and not a button, because the session detail that
 * it will open is not built yet, and a chevron on it would lead nowhere.
 */
export function SessionRow({
  weekday,
  dayOfMonth,
  title,
  meta,
  muscles,
  accessibilityLabel,
}: SessionRowProps) {
  const { isFirst } = useGroupedRowPosition();

  return (
    <View
      accessible
      aria-label={accessibilityLabel}
      className={`min-h-[68px] flex-row items-center gap-3 px-3 py-2 ${isFirst ? "" : "border-t border-border"}`}
    >
      <View className="h-[44px] w-[40px] shrink-0 items-center justify-center rounded-small bg-surface-raised">
        <Text tone="secondary" variant="caption">
          {weekday}
        </Text>
        <Text variant="body-strong">{dayOfMonth}</Text>
      </View>
      <View className="min-w-0 flex-1 gap-[2px]">
        <Text variant="body-strong">{title}</Text>
        <Text tone="secondary" variant="caption">
          {meta}
        </Text>
        {muscles === null ? null : (
          <Text tone="muted" variant="caption">
            {muscles}
          </Text>
        )}
      </View>
    </View>
  );
}
