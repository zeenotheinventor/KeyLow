import type { ReactNode } from "react";

export type ScreenHeaderProps = {
  /** The screen's name, which is also its heading for a screen reader. */
  title: string;
  /** A control of the screen's at the end of the row, such as the recipes tab's New recipe button. */
  trailing?: ReactNode;
};
