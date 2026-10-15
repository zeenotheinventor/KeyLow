import { addCalendarDays, daysSinceMonday, parseCalendarDay } from "./calendarDay";

const DAYS_IN_WEEK = 7;

/** The month (`YYYY-MM`) a calendar day (`YYYY-MM-DD`) is in. */
export const monthOf = (localDate: string): string => localDate.slice(0, 7);

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const pad = (value: number): string => String(value).padStart(2, "0");

/**
 * The calendar day `months` after `localDate` (before, when negative), on the same day of the month,
 * or on the last day of a month that is shorter. Pure: a calendar day has no time zone.
 */
export function addMonths(localDate: string, months: number): string {
  const { year, month, day } = parseCalendarDay(localDate);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth() + 1;

  return `${targetYear}-${pad(targetMonth)}-${pad(Math.min(day, daysInMonth(targetYear, targetMonth)))}`;
}

/**
 * A month (`YYYY-MM`) as the weeks of a calendar, Monday first. Each week has seven cells: a day
 * as `YYYY-MM-DD`, or null where the week reaches into the month before or after.
 */
export function monthWeeks(month: string): (string | null)[][] {
  const first = `${month}-01`;
  const { year, month: monthNumber } = parseCalendarDay(first);
  const days = Array.from({ length: daysInMonth(year, monthNumber) }, (_, index) =>
    addCalendarDays(first, index),
  );
  const leading = Array.from({ length: daysSinceMonday(first) }, () => null);
  const cells = [...leading, ...days];
  const trailing = Array.from(
    { length: (DAYS_IN_WEEK - (cells.length % DAYS_IN_WEEK)) % DAYS_IN_WEEK },
    () => null,
  );
  const padded = [...cells, ...trailing];

  return Array.from({ length: padded.length / DAYS_IN_WEEK }, (_, week) =>
    padded.slice(week * DAYS_IN_WEEK, (week + 1) * DAYS_IN_WEEK),
  );
}
