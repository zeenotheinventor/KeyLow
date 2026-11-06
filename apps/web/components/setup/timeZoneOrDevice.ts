import { isValidTimeZone } from "@keylow/core/dates";

const deviceTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The given time zone, such as the profile's, or the browser's when it is missing or not a time zone. */
export function timeZoneOrDevice(timeZone?: string | null): string {
  return timeZone !== undefined && timeZone !== null && isValidTimeZone(timeZone)
    ? timeZone
    : deviceTimeZone();
}
