export type DayPillProps = {
  /** The calendar day, `YYYY-MM-DD`. */
  localDate: string;
  /** The day of the month, such as "15". */
  dateNumber: string;
  /** The two letter day, such as "Th". */
  dayName: string;
  isToday: boolean;
  isSelected: boolean;
  isComplete: boolean;
  /** A day after today: dimmed and does nothing when pressed. */
  isFuture: boolean;
  onPress: () => void;
};
