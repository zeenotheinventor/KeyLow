import { addCalendarDays, instantAtLocalTime } from "../../dates";
import { MILLISECONDS_PER_DAY, dayNumber } from "../../dates/calendarDay";

/** A day can be completed until this hour on the next local day. Zee's ruling, KEY-1081 item 9. */
export const DAY_COMPLETE_CUTOFF_HOUR = 12;

const MILLISECONDS_PER_HOUR = 3_600_000;
// Time zones run from UTC-12 to UTC+14, so noon on the next local day falls between 22:00 UTC on the
// day itself (UTC+14) and 24:00 UTC on the day after the next (UTC-12).
const EARLIEST_CUTOFF_AFTER_DAY_START = 22 * MILLISECONDS_PER_HOUR;
const LATEST_CUTOFF_AFTER_DAY_START = 2 * MILLISECONDS_PER_DAY;

/**
 * The instant a diary day stops counting new completions and is settled: 12:00 on the next local
 * day in the given zone. Pure: the zone is required and the clock is never read.
 */
export function dayCompleteCutoff(localDate: string, timeZone: string): Date {
  return instantAtLocalTime(addCalendarDays(localDate, 1), DAY_COMPLETE_CUTOFF_HOUR, 0, timeZone);
}

/**
 * Whether an instant (milliseconds since the epoch) is before the day's cutoff. Same answer as
 * comparing with `dayCompleteCutoff`, but an instant clear of the cutoff in every zone skips the time zone
 * lookup, which keeps a streak over a long history fast.
 */
export function isBeforeDayCompleteCutoff(
  instant: number,
  localDate: string,
  timeZone: string,
): boolean {
  const dayStart = dayNumber(localDate) * MILLISECONDS_PER_DAY;

  if (instant < dayStart + EARLIEST_CUTOFF_AFTER_DAY_START) {
    return true;
  }
  if (instant >= dayStart + LATEST_CUTOFF_AFTER_DAY_START) {
    return false;
  }
  return instant < dayCompleteCutoff(localDate, timeZone).getTime();
}
