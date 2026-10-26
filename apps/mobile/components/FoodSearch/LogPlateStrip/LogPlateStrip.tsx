import { describeStripDay } from "@keylow/core/copy";

import { usePlateDayBars } from "./usePlateDayBars";
import { usePlate } from "../../../lib/plate";
import { MacroProgressStrip } from "../../ui";

import type { LogPlateStripProps } from "./types";

/**
 * The day's four bars under the search header: what was eaten (read as the diary reads it, so it shows
 * offline once the diary has been seen) and, after it, the share the plate adds. It only tells, because leaving
 * for Targets would drop the plate. Until the day, its targets and the time zone are known, or if a read
 * fails, nothing is drawn and the search works as it does without it.
 */
export function LogPlateStrip({ day }: LogPlateStripProps) {
  const { count } = usePlate();
  const dayBars = usePlateDayBars(day);

  if (dayBars === undefined) {
    return null;
  }

  return (
    <MacroProgressStrip bars={dayBars.bars} label={describeStripDay(dayBars.dayTitle, count > 0)} />
  );
}
