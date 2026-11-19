import type { CalendarDayState } from "@keylow/core";

export type StreakStripProps = {
  /** The days to draw, oldest first. The strip draws the last 14 of them. */
  calendar: readonly CalendarDayState[];
  className?: string;
};
