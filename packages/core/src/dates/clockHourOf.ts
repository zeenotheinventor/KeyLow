import { readZonedClock } from "./zonedClock";

/** The hour on the clock, 0 to 23, of an instant in the given IANA time zone. Pure: both arguments are required. */
export function clockHourOf(instant: Date, timeZone: string): number {
  return readZonedClock(instant, timeZone).hour;
}
