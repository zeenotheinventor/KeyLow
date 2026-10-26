import { useDiaryDay, useProfileTimeZone, useTargets } from "@keylow/api-client";
import { describeStripDay } from "@keylow/core/copy";
import { describeDay, instantAtLocalTime } from "@keylow/core/dates";
import { progressBars, sumEntries } from "@keylow/core/diary";

import { usePlate } from "../../../lib/plate";
import { useNow } from "../../../lib/useNow";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";
import { MacroProgressStrip } from "../../ui";

import type { LogPlateStripProps } from "./types";

const NOON = 12;

/**
 * The day's four bars under the search header: what was eaten (read as the diary reads it, so it shows
 * offline once the diary has been seen) and, after it, the share the plate adds. It only tells, because leaving
 * for Targets would drop the plate. Until the day, its targets and the time zone are known, or if a read
 * fails, nothing is drawn and the search works as it does without it.
 */
export function LogPlateStrip({ day }: LogPlateStripProps) {
  const { count, totals } = usePlate();
  const now = useNow();
  const isReadEnabled = useReadsEnabled();
  const eaten = useDiaryDay(day, { enabled: isReadEnabled }).data;
  const targets = useTargets({ enabled: isReadEnabled, localDate: day }).data;
  const profileTimeZone = useProfileTimeZone({ enabled: isReadEnabled }).data;

  if (eaten === undefined || targets === undefined || profileTimeZone === undefined) {
    return null;
  }
  const timeZone = profileTimeZone ?? "UTC";
  const dayTitle = describeDay(instantAtLocalTime(day, NOON, 0, timeZone), now, timeZone).label;

  return (
    <MacroProgressStrip
      bars={progressBars(sumEntries(eaten.entries), targets, totals)}
      label={describeStripDay(dayTitle, count > 0)}
    />
  );
}
