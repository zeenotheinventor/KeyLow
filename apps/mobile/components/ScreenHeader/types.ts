import type { ReactNode } from "react";

export type ScreenHeaderProps = {
  /** The screen's name, which is also its heading for a screen reader. */
  title: string;
  /** A control of the screen's at the end of the row, such as the recipe library's New recipe button. */
  trailing?: ReactNode;
  /**
   * The way back, drawn before the title, for a screen pushed inside a tab such as the recipe library in More.
   * `label` is the control's name for a screen reader. A tab's own screen has none.
   */
  back?: { label: string; onPress: () => void };
};
