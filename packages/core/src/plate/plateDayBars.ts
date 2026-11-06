import { describeDay } from "../dates/describeDay";
import { instantAtLocalTime } from "../dates/instantAtLocalTime";
import { progressBars } from "../diary/rules/progressBars";
import { sumEntries } from "../diary/rules/sumEntries";

import type { PlateTotals } from "./plateValues";
import type { ProgressBar, ProgressTargets } from "../diary/rules/progressBars";
import type { SummableEntry } from "../diary/rules/sumEntries";

const NOON = 12;

export type PlateDayBarsInput = {
  /** What the day holds, as the diary reads it. */
  entries: readonly SummableEntry[];
  targets: ProgressTargets;
  totals: PlateTotals;
  /** The day the dialog was opened for, `YYYY-MM-DD`. */
  day: string;
  /** The profile's zone, or null when the profile has none, which reads as UTC. */
  timeZone: string | null;
  now: Date;
};

/** The day's four bars with the plate's share after what was eaten, and the day's title: Today, Yesterday or "Wed 14 Oct". */
export type PlateDayBars = { bars: ProgressBar[]; dayTitle: string };

/** What the search's strip and the plate's totals card both show for a day, with the plate's share of each bar. */
export function plateDayBars({
  entries,
  targets,
  totals,
  day,
  timeZone,
  now,
}: PlateDayBarsInput): PlateDayBars {
  const zone = timeZone ?? "UTC";

  return {
    bars: progressBars(sumEntries(entries), targets, totals),
    dayTitle: describeDay(instantAtLocalTime(day, NOON, 0, zone), now, zone).label,
  };
}
