import type { SheetHeaderControl } from "../ui";
import type { ReactNode } from "react";

export type FoodFormScreenProps = {
  title: string;
  /**
   * Whether the title is a heading for a screen reader. Defaults to true. A screen whose body has its
   * own heading, as the food boards' failed and not found states do, turns it off so there is one.
   */
  isTitleHeading?: boolean;
  /** A control drawn between the title and Close, such as the food detail's favourite heart. */
  extraControl?: SheetHeaderControl;
  children: ReactNode;
};
