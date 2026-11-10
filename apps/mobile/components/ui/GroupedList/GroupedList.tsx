import { View } from "react-native";

import { Card } from "../Card";
import { Text } from "../Text";
import { GroupedRowPositionContext, positionedRows } from "./rowPosition";

import type { GroupedListProps } from "./types";

/**
 * A titled group of rows on a card, with the group's source beside the title. A notice about the group, such as a failed add, sits
 * between the heading and the card, which is the kit's `Card`.
 */
export function GroupedList({
  title,
  hidesTitle = false,
  label,
  source,
  notice,
  children,
}: GroupedListProps) {
  const rows = positionedRows(children);

  return (
    <View className="gap-2">
      {hidesTitle ? null : (
        // The title shrinks and wraps at large text.
        <View className="min-h-[32px] flex-row items-center justify-between gap-2 px-1">
          <Text className="shrink" role="heading" variant="body-strong">
            {title}
            {source === undefined ? null : (
              <Text tone="muted" variant="caption">
                {` · ${source}`}
              </Text>
            )}
          </Text>
        </View>
      )}
      {notice}
      {/* The rows bring their own padding, so the card has none. */}
      <Card aria-label={label ?? title} padding={0} role="list">
        {rows.map((row) => (
          <GroupedRowPositionContext key={row.key} value={row.position}>
            {/* Not `accessible`: the row inside is a button, which an accessible wrapper would fold away. */}
            <View role="listitem">{row.node}</View>
          </GroupedRowPositionContext>
        ))}
      </Card>
    </View>
  );
}
