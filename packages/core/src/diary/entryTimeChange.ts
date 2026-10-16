import { clockTimeOn } from "./openingLoggedAt";
import { formatClockTime } from "../dates/formatClockTime";

/** A time to write for an entry: the instant, and the zone it was chosen in. */
export type EntryTimeChange = { loggedAt: string; timeZone: string };

/**
 * The time to write for a Time row, or nothing while the row still reads the entry's own time. The time is on
 * the entry's own day, in the profile's zone, and the repo works out the day it falls on, so a time the zone
 * puts on another date moves the entry there. An unchanged time is not written back: the entry's seconds are
 * what keep it in its place among those at the same minute.
 */
export function entryTimeChange(
  entry: { logged_at: string; local_date: string },
  time: string,
  timeZone: string,
): EntryTimeChange | undefined {
  if (time === formatClockTime(new Date(entry.logged_at), timeZone)) {
    return undefined;
  }

  return {
    loggedAt: clockTimeOn(entry.local_date, time, timeZone).loggedAt.toISOString(),
    timeZone,
  };
}
