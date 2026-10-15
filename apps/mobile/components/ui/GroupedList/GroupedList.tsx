import { describeSeeMore } from "@keylow/core/copy";
import { View } from "react-native";

import { Card } from "../Card";
import { Text } from "../Text";
import { GroupedRowPositionContext, positionedRows } from "./rowPosition";
import { SeeMoreButton } from "./SeeMoreButton";

import type { GroupedListProps } from "./types";

/**
 * A titled group of rows on a card, with the group's source beside the title and, when the group has
 * more rows than it shows, a "See N more" button. A notice about the group, such as a failed add, sits
 * between the heading and the card, which is the kit's `Card`.
 */
export function GroupedList({ title, source, seeMore, notice, children }: GroupedListProps) {
  const rows = positionedRows(children);

  return (
    <View className="gap-2">
      {/* The title shrinks and wraps at large text, so See more is never pushed off the edge. */}
      <View className="min-h-[32px] flex-row items-center justify-between gap-2 px-1">
        <Text className="shrink" role="heading" variant="body-strong">
          {title}
          {source === undefined ? null : (
            <Text tone="muted" variant="caption">
              {` · ${source}`}
            </Text>
          )}
        </Text>
        {seeMore === undefined || seeMore.hiddenCount <= 0 ? null : (
          <SeeMoreButton
            label={`${describeSeeMore(seeMore.hiddenCount)} in ${title}`}
            text={describeSeeMore(seeMore.hiddenCount)}
            onPress={seeMore.onPress}
          />
        )}
      </View>
      {notice}
      {/* The rows bring their own padding, so the card has none. */}
      <Card aria-label={title} padding={0} role="list">
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
