import { addCalendarDays } from "../dates";

import type { DailyReading } from "./dailyMedians";

/**
 * Cuts the days, which must be in date order, into runs. A gap of more than `maxGapDays` calendar
 * days between two consecutive days starts a new run, so a gap of exactly `maxGapDays` does not.
 */
export function splitSegments(days: readonly DailyReading[], maxGapDays: number): DailyReading[][] {
  const segments: DailyReading[][] = [];

  for (const day of days) {
    const current = segments.at(-1);
    const previous = current?.at(-1);
    if (
      previous === undefined ||
      current === undefined ||
      addCalendarDays(previous.date, maxGapDays) < day.date
    ) {
      segments.push([day]);
    } else {
      current.push(day);
    }
  }
  return segments;
}
