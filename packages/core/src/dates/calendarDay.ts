export const MILLISECONDS_PER_DAY = 86_400_000;

type CalendarDay = { year: number; month: number; day: number };

/** Reads the `YYYY-MM-DD` that `toLocalDate` returns. The month is 1 to 12. */
export function parseCalendarDay(calendarDate: string): CalendarDay {
  const [year, month, day] = calendarDate.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new RangeError(`Invalid calendar date: "${calendarDate}"`);
  }
  return { year, month, day };
}

/** A running count of days, so two calendar dates subtract exactly, whatever the clocks did. */
export function dayNumber(calendarDate: string): number {
  const { year, month, day } = parseCalendarDay(calendarDate);
  return Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY;
}

/** The calendar date `days` after `calendarDate` (before, when negative), both as `YYYY-MM-DD`. */
export function addCalendarDays(calendarDate: string, days: number): string {
  return new Date((dayNumber(calendarDate) + days) * MILLISECONDS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

const DAYS_FROM_MONDAY_TO_SUNDAY = 6;
const SUNDAY = 0;

/** Days since Monday for a `YYYY-MM-DD` date: 0 for Monday up to 6 for Sunday. Weeks start on Monday. */
export function daysSinceMonday(calendarDate: string): number {
  const weekday = new Date(dayNumber(calendarDate) * MILLISECONDS_PER_DAY).getUTCDay();
  return weekday === SUNDAY ? DAYS_FROM_MONDAY_TO_SUNDAY : weekday - 1;
}
