import { readZonedClock } from "./zonedClock";

/**
 * The 24-hour clock time of an instant in the given IANA time zone, as "08:05". It is written by
 * hand from the numbers, so Hermes and Node give the same text. Pure: both arguments are required.
 */
export function formatClockTime(instant: Date, timeZone: string): string {
  const { hour, minute } = readZonedClock(instant, timeZone);

  return `${padToTwoDigits(hour)}:${padToTwoDigits(minute)}`;
}

function padToTwoDigits(value: number): string {
  return String(value).padStart(2, "0");
}
