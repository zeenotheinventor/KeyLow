import { toLocalDate } from "../../dates";
import { addCalendarDays, daysSinceMonday } from "../../dates/calendarDay";

import type { DayCompletion } from "./incompleteDaysThisWeek";

const DAYS_IN_WEEK = 7;

/** The seven calendar days, Monday to Sunday, of the week that holds `localDate` (`YYYY-MM-DD`). */
export function weekOf(localDate: string): string[] {
  const monday = addCalendarDays(localDate, -daysSinceMonday(localDate));

  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => addCalendarDays(monday, index));
}

/** The week seven days before the week that holds `localDate`. */
export function previousWeek(localDate: string): string[] {
  return weekOf(addCalendarDays(localDate, -DAYS_IN_WEEK));
}

/** The week seven days after the week that holds `localDate`. */
export function nextWeek(localDate: string): string[] {
  return weekOf(addCalendarDays(localDate, DAYS_IN_WEEK));
}

export type WeekStripInput = {
  /** Any day in the week to show, `YYYY-MM-DD`. */
  weekOf: string;
  /** The day the diary is showing, `YYYY-MM-DD`. */
  selectedDate: string;
  /** The current time, passed in by the caller. This module never reads a clock. */
  now: Date;
  /** The `day_logs` rows known for the week. A day with no row is not complete. */
  dayLogs: readonly DayCompletion[];
};

export type WeekStripDay = {
  localDate: string;
  isSelected: boolean;
  isToday: boolean;
  /** A day after today: muted and not pressable on the strip. */
  isFuture: boolean;
  isComplete: boolean;
};

/**
 * What each pill on the week strip needs, Monday to Sunday: whether the day is selected, is today,
 * is still to come, or has been marked complete. Today is the calendar day of `now` in `timeZone`.
 * Pure: the time zone is required and the clock is never read.
 */
export function weekStripDays(input: WeekStripInput, timeZone: string): WeekStripDay[] {
  const today = toLocalDate(input.now, timeZone);
  const completeDays = new Set(
    input.dayLogs.filter((day) => day.is_complete).map((day) => day.local_date),
  );

  return weekOf(input.weekOf).map((localDate) => ({
    localDate,
    isSelected: localDate === input.selectedDate,
    isToday: localDate === today,
    isFuture: localDate > today,
    isComplete: completeDays.has(localDate),
  }));
}
