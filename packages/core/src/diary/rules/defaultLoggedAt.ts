import { instantAtLocalTime, toLocalDate } from "../../dates";
import { readZonedClock } from "../../dates/zonedClock";

export type DefaultLoggedAtInput = {
  /** The current time, passed in by the caller. This module never reads a clock. */
  now: Date;
  /** The day the diary is showing, `YYYY-MM-DD` in the zone. */
  viewedDate: string;
  /** Set when the food is added from an hour's plus: 0 to 23. Leave out for the tab bar or search dock. */
  hour?: number;
};

export type DefaultLoggedAt = {
  /** The instant to log the food at. */
  loggedAt: Date;
  /** The calendar day that instant belongs to in the zone, for `local_date`. */
  localDate: string;
};

/**
 * The time a new entry gets by default, by where it was added from (brief 16, ADR 0003 Amendment 5):
 *
 * - from an hour's plus: that hour at :00 on the viewed day;
 * - from the tab bar plus or the search dock while viewing today: now;
 * - from the same while viewing another day: the current clock time (hours and minutes) on that day.
 *
 * A wall-clock time the clocks skip or repeat resolves the platform's compatible way. Pure: the time
 * zone is required, `now` is passed in and the clock is never read.
 */
export function defaultLoggedAt(input: DefaultLoggedAtInput, timeZone: string): DefaultLoggedAt {
  const loggedAt = chooseInstant(input, timeZone);

  return { loggedAt, localDate: toLocalDate(loggedAt, timeZone) };
}

function chooseInstant({ now, viewedDate, hour }: DefaultLoggedAtInput, timeZone: string): Date {
  if (hour !== undefined) {
    return instantAtLocalTime(viewedDate, hour, 0, timeZone);
  }
  if (toLocalDate(now, timeZone) === viewedDate) {
    return now;
  }
  const clock = readZonedClock(now, timeZone);
  return instantAtLocalTime(viewedDate, clock.hour, clock.minute, timeZone);
}
