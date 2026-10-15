export type WeekStripDayInput = {
  /** The calendar day, `YYYY-MM-DD`. */
  localDate: string;
  isComplete: boolean;
};

export type WeekStripWeekChange = "previous" | "next";

export type WeekStripProps = {
  /** The seven days of the week, Monday to Sunday, as core's `weekOf` lists them. */
  days: readonly WeekStripDayInput[];
  /** The day the diary is showing, `YYYY-MM-DD`. */
  selectedDate: string;
  /** Today, `YYYY-MM-DD`. A day after it is dimmed and cannot be pressed, and the strip stops at its week. */
  today: string;
  onSelectDay: (localDate: string) => void;
  /** A swipe to move a week back or forward. The strip never asks for a week that starts after today. */
  onWeekChange: (direction: WeekStripWeekChange) => void;
};

export type DayPillProps = {
  /** The day of the month, such as "15". */
  dateNumber: string;
  /** The two letter day, such as "Th". */
  dayName: string;
  state: { localDate: string; isToday: boolean; isSelected: boolean; isComplete: boolean };
  /** A day after today: dimmed and not pressable. */
  isFuture: boolean;
  onPress: () => void;
};
