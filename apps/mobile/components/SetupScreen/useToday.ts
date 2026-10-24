import { isValidTimeZone, toLocalDate } from "@keylow/core/dates";

import { useNow } from "../../lib/useNow";

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The given time zone, such as the profile's, or the device's when it is missing or not a time zone. */
export function timeZoneOrDevice(timeZone?: string | null): string {
  return timeZone !== undefined && timeZone !== null && isValidTimeZone(timeZone)
    ? timeZone
    : deviceTimeZone();
}

/**
 * Today as `YYYY-MM-DD` in the device's time zone, which moves on by itself at midnight. Given a time
 * zone, such as the profile's, it is today there, and one that is missing or not a time zone is the
 * device's.
 */
export function useToday(timeZone?: string | null): string {
  const now = useNow();
  return toLocalDate(now, timeZoneOrDevice(timeZone));
}
