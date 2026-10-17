import type { ReactNode } from "react";

export type BottomSheetProps = {
  open: boolean;
  /**
   * Called when the user closes the sheet: a press on the dim behind it, a drag down, the screen reader's
   * escape gesture or the Android back button. The screen then sets `open` to false. It is not called
   * when the screen closes the sheet itself.
   */
  onClose: () => void;
  /**
   * Whether a drag down can close the sheet. A screen that cannot close it yet, such as one with an
   * edit it would have to drop, turns this off and ignores `onClose` from the dim, the screen reader's
   * escape and the back button. Defaults to true.
   */
  isDismissible?: boolean | undefined;
  /** Sets the sheet's heading and its accessible name. Leave it out when the contents have their own. */
  title?: string | undefined;
  /** Centres the title, as the discard sheet's board draws it. Defaults to the start of the line. */
  isTitleCentred?: boolean | undefined;
  /**
   * The sheet's accessible name, for a sheet whose contents have a heading of their own and so draw no
   * title, such as the date picker's month. The sheet is named by `title` when it has one, and this adds
   * no heading.
   */
  label?: string | undefined;
  children?: ReactNode;
};
