import type { ReactNode } from "react";

export type GroupedListProps = {
  /** The group's name. It heads the section and names the list. */
  title: string;
  /**
   * Draws the card without its heading row, for a screen whose boards show only the card, such as the
   * recipe library. The title still names the list for a screen reader. `source` is part of
   * the heading row, so it is not drawn either.
   */
  hidesTitle?: boolean | undefined;
  /** Names the list for a screen reader in place of the title, when the heading's words alone say too little, such as "Your recipes, values per serving". */
  label?: string | undefined;
  /** Where the group comes from, written after the title, such as "UK CoFID". */
  source?: string | undefined;
  /** A notice about this group, drawn between the heading and the card: a `Banner`, as the add failure board draws one. */
  notice?: ReactNode;
  /** The rows: `ListRow` or `FoodRow`. */
  children: ReactNode;
};
