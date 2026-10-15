import type { RefObject } from "react";

/** How the picker was closed. Only Done applies the time. */
export type TimePickerCloseReason = "done" | "escape" | "outside";

export type TimePickerProps = {
  open: boolean;
  /** The time the picker starts from each time it opens, as `HH:mm`. */
  value: string;
  /** Called with the chosen `HH:mm` when Done (or Enter) is pressed, just before `onClose("done")`. */
  onApply: (time: string) => void;
  /** Called when the picker should go: after Done, on Escape, and on a press outside it. Closing any way but Done discards the choice. */
  onClose: (reason: TimePickerCloseReason) => void;
  /**
   * The control that opens the picker. A press on it is not an outside press, so that it can toggle
   * the picker without closing and reopening it.
   */
  anchorRef?: RefObject<HTMLElement | null> | undefined;
};
