import { MILLISECONDS_PER_DAY, parseCalendarDay } from "./calendarDay";
import { readZonedClock } from "./zonedClock";

const MILLISECONDS_PER_MINUTE = 60_000;

/**
 * The instant at which the wall clock in the given IANA time zone reads `hour:minute` on
 * `localDate` (`YYYY-MM-DD`). A time the clocks skip (the gap when they go forward) and a time
 * they repeat (the overlap when they go back) resolve the platform's compatible way: a gap time
 * takes the offset from before the change, so London 01:30 on 29 March 2026 is the instant that
 * reads 02:30, and an overlap time is its first pass. Pure: the time zone is required and the clock
 * is never read.
 */
export function instantAtLocalTime(
  localDate: string,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`Invalid hour: ${hour}`);
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new RangeError(`Invalid minute: ${minute}`);
  }

  const { year, month, day } = parseCalendarDay(localDate);
  // The wall-clock time read as if it were UTC. The zone's offset moves it to the true instant.
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);

  const offsetBefore = offsetAt(wallClockAsUtc - MILLISECONDS_PER_DAY, timeZone);
  const offsetAfter = offsetAt(wallClockAsUtc + MILLISECONDS_PER_DAY, timeZone);

  const candidates = [offsetBefore, offsetAfter]
    .map((offset) => wallClockAsUtc - offset)
    .filter((candidate) => offsetAt(candidate, timeZone) === wallClockAsUtc - candidate);

  // Two valid candidates are an overlap: the earlier instant is the first pass. None is a gap:
  // the offset from before the change applies.
  return new Date(candidates.length > 0 ? Math.min(...candidates) : wallClockAsUtc - offsetBefore);
}

/** The zone's offset from UTC at an instant, in milliseconds: wall clock as UTC minus the instant. */
function offsetAt(instantMilliseconds: number, timeZone: string): number {
  const clock = readZonedClock(new Date(instantMilliseconds), timeZone);
  const wallClockAsUtc = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute);

  // The clock has no seconds, so the offset is read at the minute the instant falls in.
  return (
    wallClockAsUtc -
    Math.floor(instantMilliseconds / MILLISECONDS_PER_MINUTE) * MILLISECONDS_PER_MINUTE
  );
}
