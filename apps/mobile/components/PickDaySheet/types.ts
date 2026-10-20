/** A day of the active routine as the Pick day sheet lists it. */
export type PickDayOption = {
  id: string;
  name: string;
  /** The day's date this week, `YYYY-MM-DD`, or null for a day with no weekday. */
  date: string | null;
  exerciseCount: number;
  setCount: number;
};

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
