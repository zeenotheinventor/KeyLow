import { isValidTimeZone, toLocalDate } from "@keylow/core/dates";

import { useNow } from "../../lib/useNow";

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Today as `YYYY-MM-DD` in the device's time zone, which moves on by itself at midnight. Given a time
 * zone, such as the profile's, it is today there, and one that is missing or not a time zone is the
 * device's.
 */
export function useToday(timeZone?: string | null): string {
  const now = useNow();
  return toLocalDate(
    now,
    timeZone !== undefined && timeZone !== null && isValidTimeZone(timeZone)
      ? timeZone
      : deviceTimeZone(),
  );
}
