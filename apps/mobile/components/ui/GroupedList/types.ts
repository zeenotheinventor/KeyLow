import type { ReactNode } from "react";

export type GroupedListSeeMore = {
  /** How many rows are not shown. Nothing is offered when it is 0. */
  hiddenCount: number;
  /** Reveals the hidden rows. The caller owns which rows are shown. */
  onPress: () => void;
};

export type GroupedListProps = {
  /** The group's name. It heads the section and names the list. */
  title: string;
  /** Where the group comes from, written after the title, such as "UK CoFID". */
  source?: string | undefined;
  /** Offers the rows that are not shown. */
  seeMore?: GroupedListSeeMore | undefined;
  /** The rows: `ListRow` or `FoodRow`. */
  children: ReactNode;
};
