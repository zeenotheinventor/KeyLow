import { createContext, useContext } from "react";

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
