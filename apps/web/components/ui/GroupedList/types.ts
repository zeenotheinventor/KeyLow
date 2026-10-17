import type * as React from "react";

export type GroupedListProps = {
  /** The group's name. It heads the section and names it. */
  title: string;
  /** Where the group comes from, written after the title, such as "UK CoFID". */
  source?: string;
  /**
   * The section's name when it should read other than the title, such as "Your recipes, values per serving"
   * for the title "Your recipes" and its caption. The title still heads the section.
   */
  label?: string;
  /** Offers the rows that are not shown. Nothing is offered when `hiddenCount` is 0. */
  seeMore?: { hiddenCount: number; onClick: () => void };
  /**
   * How tall the header row is. `default` holds 32 px, which gives a See more button its room.
   * `compact` is the bare heading line, for a group that never has one, such as the lists on More.
   */
  headerSize?: "default" | "compact";
  /** A notice about the group, such as a `Banner`, drawn between the heading and the rows. */
  notice?: React.ReactNode;
  /** The rows, such as `ListRow` or `FoodRow`. */
  children: React.ReactNode;
  className?: string;
};
