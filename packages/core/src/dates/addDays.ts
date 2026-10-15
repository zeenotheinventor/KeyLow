import { MILLISECONDS_PER_DAY, dayNumber } from "./calendarDay";
import { toLocalDate } from "./toLocalDate";

const MILLISECONDS_PER_HOUR = 3_600_000;

// A clock change makes a day 23 or 25 hours long, so a step of 24 hours can land on the wrong
// calendar day. The nudges put that right and move the time of day by an hour at most.
const NUDGES = [0, MILLISECONDS_PER_HOUR, -MILLISECONDS_PER_HOUR];

/**
 * The instant `days` calendar days from `date` in the given IANA time zone, at about the same time
 * of day. Pure: the time zone is required and the clock is never read.
 */
export function addDays(date: Date, days: number, timeZone: string): Date {
  const target = dayNumber(toLocalDate(date, timeZone)) + days;
  const candidate = date.getTime() + days * MILLISECONDS_PER_DAY;

  for (const nudge of NUDGES) {
    const moved = new Date(candidate + nudge);
    if (dayNumber(toLocalDate(moved, timeZone)) === target) {
      return moved;
    }
  }
  return new Date(candidate);
}
