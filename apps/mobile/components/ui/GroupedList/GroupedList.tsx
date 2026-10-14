import { describeSeeMore } from "@keylow/core/copy";
import { Children, Fragment, isValidElement } from "react";
import { View } from "react-native";

import { Text } from "../Text";
import { GroupedRowPositionContext } from "./rowPosition";
import { SeeMoreButton } from "./SeeMoreButton";

import type { GroupedListProps } from "./types";
import type { ReactNode } from "react";

// Each row is told whether it is first. These are made once, so a row does not render for a new object.
const firstRow = { isFirst: true };
const followingRow = { isFirst: false };

type Row = { key: string; node: ReactNode };

// The rows of the list in order, with those inside a fragment counted as rows of their own, so a
// fragment does not make the rows inside it look like one. Each has a key that holds its place.
function flattenRows(children: ReactNode, parentKey = ""): Row[] {
  return Children.toArray(children).flatMap((child, index) => {
    const key = `${parentKey}/${isValidElement(child) && child.key !== null ? child.key : index}`;
    return isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? flattenRows(child.props.children, key)
      : [{ key, node: child }];
  });
}

/**
 * A titled group of rows on a card, with the group's source beside the title and, when the group has
 * more rows than it shows, a "See N more" button. The card is the design system's `Card`, drawn here
 * because the mobile kit has none yet.
 */
export function GroupedList({ title, source, seeMore, children }: GroupedListProps) {
  const rows = flattenRows(children);

  return (
    <View className="gap-2">
      <View className="min-h-[32px] flex-row items-center justify-between gap-2 px-1">
        <Text role="heading" variant="body-strong">
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
      <View
        aria-label={title}
        className="overflow-hidden rounded-large border border-border bg-surface elevation-card"
        role="list"
      >
        {rows.map((row, index) => (
          <GroupedRowPositionContext key={row.key} value={index === 0 ? firstRow : followingRow}>
            {row.node}
          </GroupedRowPositionContext>
        ))}
      </View>
    </View>
  );
}
