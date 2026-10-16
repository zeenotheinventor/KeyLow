import { parseCalendarDay } from "./calendarDay";
import { formatClockTime } from "./formatClockTime";
import { toLocalDate } from "./toLocalDate";
import { MONTH_NAMES_SHORT } from "../copy/diaryDay";

/**
 * The date and time of an instant in the given IANA time zone, as "16 Oct 2026, 14:03": the day number
 * without a leading zero, a short month name, the year, then the 24-hour clock. It is written by hand, so
 * Hermes and Node give the same text. Pure: both arguments are required.
 */
export function formatDateTime(instant: Date, timeZone: string): string {
  const { year, month, day } = parseCalendarDay(toLocalDate(instant, timeZone));

  return `${day} ${MONTH_NAMES_SHORT[month - 1]} ${year}, ${formatClockTime(instant, timeZone)}`;
}
