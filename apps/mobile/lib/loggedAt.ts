import {
  formatClockTime,
  instantAtLocalTime,
  parseClockTime,
  toLocalDate,
} from "@keylow/core/dates";
import { defaultLoggedAt } from "@keylow/core/diary";

import type { LogContext } from "./navigation";

type LoggedAt = { loggedAt: Date; localDate: string };

/**
 * When a food added from the sheet is logged until the person chooses a time: the instant core's
 * `defaultLoggedAt` gives for where the sheet was opened from, with its clock time for the Time row. From
 * an hour's plus (`time` is given) it is that hour on the hour. Otherwise it is now, or on a past day the
 * current clock time on that day. Without a log context it is now on today.
 */
export function openingLoggedAt(
  now: Date,
  context: LogContext | undefined,
  timeZone: string,
): LoggedAt & { clockTime: string } {
  const hour = context?.time === undefined ? undefined : parseClockTime(context.time)?.hour;
  const viewedDate = context?.day ?? toLocalDate(now, timeZone);
  const logged = defaultLoggedAt(
    { now, viewedDate, ...(hour === undefined ? {} : { hour }) },
    timeZone,
  );

  return { ...logged, clockTime: formatClockTime(logged.loggedAt, timeZone) };
}

/** The instant the zone's clock reads `HH:mm` on a day, which is what a time chosen on the Time row means. */
export function clockTimeOn(day: string, clockTime: string, timeZone: string): LoggedAt {
  const parsed = parseClockTime(clockTime);
  if (parsed === undefined) {
    throw new RangeError("Not a 24-hour clock time");
  }
  const loggedAt = instantAtLocalTime(day, parsed.hour, parsed.minute, timeZone);

  return { loggedAt, localDate: toLocalDate(loggedAt, timeZone) };
}
