import type { PickDayOption } from "@keylow/api-client";

export type { PickDayOption };

export type PickDayDialogProps = {
  open: boolean;
  /** Called for the Close control, Escape and a press on the dimmed page. */
  onClose: () => void;
  /** The routine's days in routine order. */
  days: readonly PickDayOption[];
  /** The day whose start is under way, which shows a spinner in place of its chevron. Null when none is. */
  startingDayId: string | null;
  /** Dims the days and stops them responding: the browser is offline, or a start is under way. */
  isDisabled: boolean;
  /** Starts the session of the day pressed. The dialog stays open, so a failed start can be pressed again. */
  onPick: (dayId: string) => void;
};
