import { isCalendarDay, parseClockTime } from "@keylow/core/dates";

/**
 * Where food is being logged: the calendar day the diary shows and, when the food was added from an hour's
 * plus, that hour as `HH:mm`. These are the `day` and `time` query parameters the food sheet and the screens
 * it opens carry, with the names the diary sends. Log mode is on when `day` is present.
 */
export type LogContext = { day: string; time?: string };

type QueryParam = string | string[] | undefined;

const firstOf = (param: QueryParam): string | undefined =>
  Array.isArray(param) ? param[0] : param;

/**
 * Reads the log context from a route's query parameters. A missing or impossible `day` is no context, so a
 * link someone made up cannot put the sheet in log mode on a day that does not exist. A `time` that is not
 * a 24-hour time is left out and the day is kept.
 */
export function readLogContext(params: {
  day?: QueryParam;
  time?: QueryParam;
}): LogContext | undefined {
  const day = firstOf(params.day);
  if (day === undefined || !isCalendarDay(day)) {
    return undefined;
  }
  const time = firstOf(params.time);

  return time !== undefined && parseClockTime(time) !== undefined ? { day, time } : { day };
}

/** A path with the log context and any extra parameters as its query, so the next screen is in the same log mode. */
export function withLogContext(
  path: string,
  context: LogContext | undefined,
  extra: Record<string, string> = {},
): string {
  const query = [...Object.entries(context ?? {}), ...Object.entries(extra)]
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("&");

  return query === "" ? path : `${path}?${query}`;
}
