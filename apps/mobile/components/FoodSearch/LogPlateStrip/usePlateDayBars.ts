import { useDiaryDay, useProfileTimeZone, useTargets } from "@keylow/api-client";
import { describeDay, instantAtLocalTime } from "@keylow/core/dates";
import { progressBars, sumEntries } from "@keylow/core/diary";

import { usePlate } from "../../../lib/plate";
import { useNow } from "../../../lib/useNow";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";

import type { ProgressBar } from "@keylow/core/diary";

const NOON = 12;

/** The day's four bars with the plate's share after what was eaten, and the day's title: Today, Yesterday or "Wed 14 Oct". */
export type PlateDayBars = { bars: ProgressBar[]; dayTitle: string };

/**
 * What the search's strip and the plate sheet's totals card both show: what was eaten on the day (read as the
 * diary reads it, so it shows offline once the diary has been seen), the day's targets, and the plate's share
 * of each bar. It is undefined until the day, its targets and the time zone are known, or if a read fails.
 */
export function usePlateDayBars(day: string): PlateDayBars | undefined {
  const { totals } = usePlate();
  const now = useNow();
  const isReadEnabled = useReadsEnabled();
  const eaten = useDiaryDay(day, { enabled: isReadEnabled }).data;
  const targets = useTargets({ enabled: isReadEnabled, localDate: day }).data;
  const profileTimeZone = useProfileTimeZone({ enabled: isReadEnabled }).data;

  if (eaten === undefined || targets === undefined || profileTimeZone === undefined) {
    return undefined;
  }
  const timeZone = profileTimeZone ?? "UTC";

  return {
    bars: progressBars(sumEntries(eaten.entries), targets, totals),
    dayTitle: describeDay(instantAtLocalTime(day, NOON, 0, timeZone), now, timeZone).label,
  };
}
