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
