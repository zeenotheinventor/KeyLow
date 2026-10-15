import { Children, Fragment, createContext, isValidElement, useContext } from "react";

import type { ReactNode } from "react";

type GroupedRowPosition = { isFirst: boolean };

/** `GroupedList` gives each row its place, and a row on its own is the first. */
export const GroupedRowPositionContext = createContext<GroupedRowPosition>({ isFirst: true });

/**
 * For a row that can sit in a `GroupedList`: every row after the first has a hairline above it, drawn
 * inside the row's own height as the boards draw it, so the row's minimum height includes the line.
 */
export function useGroupedRowPosition(): GroupedRowPosition {
  return useContext(GroupedRowPositionContext);
}

// Each row is told whether it is first. These are made once, so a row does not render for a new object.
const firstRow: GroupedRowPosition = { isFirst: true };
const followingRow: GroupedRowPosition = { isFirst: false };

export type PositionedRow = { key: string; node: ReactNode; position: GroupedRowPosition };

/**
 * The rows of a list of children in order, each with its place for `GroupedRowPositionContext`, with
 * those inside a fragment counted as rows of their own, so a fragment does not make the rows inside it
 * look like one. Each has a key that holds its place. A card of rows, `GroupedList` or an hour's foods,
 * wraps each row's node in the context with its position.
 */
export function positionedRows(children: ReactNode, parentKey = ""): PositionedRow[] {
  return flattenRows(children, parentKey).map((row, index) => ({
    ...row,
    position: index === 0 ? firstRow : followingRow,
  }));
}

function flattenRows(children: ReactNode, parentKey: string): { key: string; node: ReactNode }[] {
  return Children.toArray(children).flatMap((child, index) => {
    const key = `${parentKey}/${isValidElement(child) && child.key !== null ? child.key : index}`;
    return isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? flattenRows(child.props.children, key)
      : [{ key, node: child }];
  });
}
