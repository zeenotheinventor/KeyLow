import { compareEntriesByTime } from "./compareEntriesByTime";
import { readZonedClock } from "../../dates/zonedClock";

import type { TimelineEntry } from "./compareEntriesByTime";

const HOURS_PER_DAY = 24;

export type HourGroup<Entry extends TimelineEntry> = {
  /** 0 to 23. */
  hour: number;
  /** The label of the hour's chip, such as "08:00". */
  label: string;
  /** The hour's entries in timeline order. Empty for an hour with nothing logged. */
  entries: Entry[];
};

/**
 * Groups a day's entries into the 24 hours of the diary's food log, 00 to 23, by the hour of
 * `logged_at` on the clock in `timeZone`. Every hour is returned, each with its entries in timeline
 * order. When the clocks change, an hour is skipped or repeated on the wall clock, but the log keeps
 * 24 groups, and a repeated hour holds both passes in time order. Pure: the time zone is required.
 */
export function groupEntriesByHour<Entry extends TimelineEntry>(
  entries: readonly Entry[],
  timeZone: string,
): HourGroup<Entry>[] {
  const groups: HourGroup<Entry>[] = Array.from({ length: HOURS_PER_DAY }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    entries: [],
  }));

  for (const entry of [...entries].sort(compareEntriesByTime)) {
    const { hour } = readZonedClock(new Date(entry.logged_at), timeZone);
    groups[hour]?.entries.push(entry);
  }

  return groups;
}
