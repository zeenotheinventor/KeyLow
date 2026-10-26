import type { LogContext } from "@keylow/core/diary";

export type PlateSheetProps = {
  open: boolean;
  /**
   * Called when the person closes the sheet, or when the last food is taken off. The plate stays as it is.
   * It is not called while the plate is being logged, because the sheet then has to stay for the answer.
   */
  onClose: () => void;
  /** The day (and hour) the search was opened for, which the plate is logged to and the totals are read for. */
  context: LogContext;
};
