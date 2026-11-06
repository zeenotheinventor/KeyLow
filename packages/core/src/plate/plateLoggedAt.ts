import { clockTimeOn, openingLoggedAt } from "../diary/openingLoggedAt";

import type { PlateTime } from "./types";

export type PlateLoggedAtInput = {
  /** The moment Log is pressed. */
  now: Date;
  /** The day the plate is for, `YYYY-MM-DD`, or undefined for today. */
  day: string | undefined;
  time: PlateTime;
  /** The profile's time zone. */
  timeZone: string;
};

/**
 * When the plate is logged, as `useLogPlateEntries` takes it. Now is the moment Log is pressed, which on a
 * past day is the current clock time on that day. A chosen time is that clock time on the plate's day.
 * Both are read in the profile's zone.
 */
export function plateLoggedAt({ now, day, time, timeZone }: PlateLoggedAtInput): {
  loggedAt: Date;
  localDate: string;
} {
  const opening = openingLoggedAt(now, day === undefined ? undefined : { day }, timeZone);

  if (time.isNow) {
    return { loggedAt: opening.loggedAt, localDate: opening.localDate };
  }

  return clockTimeOn(opening.localDate, time.time, timeZone);
}
