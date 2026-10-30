import type { PickDayOption } from "@keylow/api-client";

export type { PickDayOption };

export type PickDaySheetProps = {
  open: boolean;
  /** Called when the sheet is closed: its Close control, the dim, a drag down or the back button. */
  onClose: () => void;
  /** The routine's days in routine order. */
  days: readonly PickDayOption[];
  /** The day whose start is under way, which shows a spinner in place of its chevron. Null when none is. */
  startingDayId: string | null;
  /** Dims the days and stops them responding: the phone is offline, or a start is under way. */
  isDisabled: boolean;
  /** Starts the session of the day pressed. The sheet stays open, so a failed start can be pressed again. */
  onPick: (dayId: string) => void;
};
