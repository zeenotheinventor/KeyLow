import { requireTimeZone, weekDays } from "./expandPlan";
import { parseMoment } from "./muscleState";
import { instantAtLocalTime } from "../dates/instantAtLocalTime";
import { toLocalDate } from "../dates/toLocalDate";

import type { BodyMapView } from "./bodyMapValues";

/*
 * The moments of the body map's day scrubber (ADR 0005, "The body map" and "Projected against actual").
 * Pure under the ADR 0002 rule: `now` is an argument, and nothing reads the clock.
 */

/** The local time a past or future day shows on the scrubber. */
const SCRUBBER_HOUR = 20;
const SCRUBBER_MINUTE = 0;

export type DayMoment = {
  /** The calendar day, `YYYY-MM-DD` in the week's zone. */
  date: string;
  /** The instant the day shows, an ISO timestamp in UTC: 20:00 local, or `now` on today. */
  at: string;
  isToday: boolean;
  /** Whether the day can be picked in each view: Actual stops at today, Projected goes to the end of the week. */
  selectable: Record<BodyMapView, boolean>;
};

export type DayMoments = {
  /** The seven days of the week, Monday first. */
  days: DayMoment[];
  /**
   * True when today is in the week. Projected counts a planned session only from the day after (Zee's
   * ruling D on KEY-339), so on today it reads what is logged, as Actual does, and the screen says so.
   */
  todayProjectedIsActual: boolean;
};

export type DayMomentsInput = Readonly<{
  /** The Monday that starts the week, `YYYY-MM-DD`. */
  weekStart: string;
  /** The user's IANA time zone. */
  tz: string;
  /** The current moment, an ISO timestamp with a zone. */
  now: string;
}>;

/**
 * The seven days of the week that starts on `weekStart` and the instant each shows on the scrubber:
 * 20:00 local on a past or future day, built with `instantAtLocalTime` so a day the clocks change on is
 * right, and `now` on today. Both views read heat at the instant of the day picked: Actual with
 * `muscleState` and Projected with `projectedState`.
 *
 * Throws a `RangeError` naming the rule when the week does not start on a Monday, the zone is not an
 * IANA name, or `now` is not an ISO timestamp with a zone.
 */
export const dayMoments = ({ weekStart, tz, now }: DayMomentsInput): DayMoments => {
  const dates = weekDays(weekStart);
  requireTimeZone(tz);
  const nowInstant = new Date(parseMoment(now));
  const today = toLocalDate(nowInstant, tz);
  const days = dates.map((date): DayMoment => {
    const isToday = date === today;
    const at = isToday ? nowInstant : instantAtLocalTime(date, SCRUBBER_HOUR, SCRUBBER_MINUTE, tz);
    return {
      date,
      at: at.toISOString(),
      isToday,
      selectable: { actual: date <= today, projected: true },
    };
  });
  return { days, todayProjectedIsActual: dates.includes(today) };
};
