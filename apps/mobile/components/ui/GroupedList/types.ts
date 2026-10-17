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
  /**
   * Draws the card without its heading row, for a screen whose boards show only the card, such as the
   * recipe library. The title still names the list for a screen reader. `source` and `seeMore` are
   * part of the heading row, so they are not drawn either.
   */
  hidesTitle?: boolean | undefined;
  /** Names the list for a screen reader in place of the title, when the heading's words alone say too little, such as "Your recipes, values per serving". */
  label?: string | undefined;
  /** Where the group comes from, written after the title, such as "UK CoFID". */
  source?: string | undefined;
  /** Offers the rows that are not shown. */
  seeMore?: GroupedListSeeMore | undefined;
  /** A notice about this group, drawn between the heading and the card: a `Banner`, as the add failure board draws one. */
  notice?: ReactNode;
  /** The rows: `ListRow` or `FoodRow`. */
  children: ReactNode;
};
