import { readZonedClock } from "./zonedClock";

/**
 * Returns the calendar date (`YYYY-MM-DD`) of an instant in the given IANA time zone.
 * Supports years 1000 to 9999.
 * Pure: both arguments are required, there is no default time zone and no clock access.
 */
export function toLocalDate(instant: Date, timeZone: string): string {
  const { year, month, day } = readZonedClock(instant, timeZone);

  return `${year}-${padToTwoDigits(month)}-${padToTwoDigits(day)}`;
}

function padToTwoDigits(value: number): string {
  return String(value).padStart(2, "0");
}
