import type { AddFoodRequest } from "@/lib/foodLogActions";

export type QuickAddDialogProps = {
  /** The day to log on, and the hour when an hour's plus asked for one. */
  request: AddFoodRequest;
  /**
   * The control the first dialog was opened from, which focus goes back to when this one closes. It is the
   * diary's hour plus, Edit button or the top bar's search, and not whatever was focused inside a dialog before.
   */
  opener: Element | null;
  /** Called to close the dialog: Cancel, Close, Escape, or after Add. */
  onClose: () => void;
  /**
   * Called instead of `onClose` after the entry was logged, for a caller that answers a log differently from a
   * close, such as the Add food dialog, which returns to its search when the plate has food and closes when not.
   */
  onLogged?: (() => void) | undefined;
};
