/** What a day's 6 point dot says: a filled dot, an accent dot, a ring, or nothing. */
export type DayScrubberDot = "logged" | "running" | "planned" | "none";

export type DayScrubberDay = {
  /** The calendar day, `YYYY-MM-DD`. */
  date: string;
  /** The column head: "Mon". */
  weekday: string;
  /** The day of the month: "12". */
  dayOfMonth: string;
  /** The whole day for a screen reader: "Thursday 15 October, today, Legs in progress". */
  accessibleName: string;
  dot: DayScrubberDot;
  isToday: boolean;
  /** The day cannot be chosen in the view shown. It is drawn at 40 percent and does nothing when pressed. */
  isDisabled: boolean;
};

export type DayScrubberProps = {
  /** The days of the week, Monday first. */
  days: readonly DayScrubberDay[];
  /** The `date` of the day chosen. */
  selectedDate: string;
  /** Called with the `date` of a day that is pressed and can be chosen. */
  onSelect: (date: string) => void;
};
