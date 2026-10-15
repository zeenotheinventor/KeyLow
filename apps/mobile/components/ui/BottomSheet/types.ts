import type { ReactNode } from "react";

export type BottomSheetProps = {
  open: boolean;
  /**
   * Called when the user closes the sheet: a press on the dim behind it, a drag down, the screen reader's
   * escape gesture or the Android back button. The screen then sets `open` to false. It is not called
   * when the screen closes the sheet itself.
   */
  onClose: () => void;
  /** Sets the sheet's heading and its accessible name. Leave it out when the contents have their own. */
  title?: string | undefined;
  /**
   * The sheet's accessible name, for a sheet whose contents have a heading of their own and so draw no
   * title, such as the date picker's month. The sheet is named by `title` when it has one, and this adds
   * no heading.
   */
  label?: string | undefined;
  children?: ReactNode;
};
