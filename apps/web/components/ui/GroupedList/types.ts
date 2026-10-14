import type * as React from "react";

export type GroupedListProps = {
  /** The group's name. It heads the section and names it. */
  title: string;
  /** Where the group comes from, written after the title, such as "UK CoFID". */
  source?: string;
  /** Offers the rows that are not shown. Nothing is offered when `hiddenCount` is 0. */
  seeMore?: { hiddenCount: number; onClick: () => void };
  /** A notice about the group, such as a `Banner`, drawn between the heading and the rows. */
  notice?: React.ReactNode;
  /** The rows, such as `ListRow` or `FoodRow`. */
  children: React.ReactNode;
  className?: string;
};
