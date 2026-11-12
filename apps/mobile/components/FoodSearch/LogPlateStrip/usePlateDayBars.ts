import { useDiaryDay, useProfileTimeZone, useTargets } from "@keylow/api-client";
import { plateDayBars } from "@keylow/core/plate";

import { usePlate } from "../../../lib/plate";
import { useNow } from "../../../lib/useNow";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";

import type { PlateDayBars } from "@keylow/core/plate";

export type { PlateDayBars };

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

  return plateDayBars({
    entries: eaten.entries,
    targets,
    totals,
    day,
    timeZone: profileTimeZone,
    now,
  });
}
