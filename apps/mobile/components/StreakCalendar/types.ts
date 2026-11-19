import type { CalendarDayState } from "@keylow/core";

export type StreakCalendarProps = {
  /** The local date, `YYYY-MM-DD`. The month it is in is the month drawn. */
  today: string;
  /** What core's engine says each day is: `run.calendar`, over the range `streakCalendarRangeOf` gives. */
  calendar: readonly CalendarDayState[];
  /** The current daily streak, in days. */
  current: number;
  /** The longest daily streak, kept for ever. */
  longest: number;
  freezesHeld: number;
};
