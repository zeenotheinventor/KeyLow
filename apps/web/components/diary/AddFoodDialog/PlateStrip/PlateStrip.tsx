import { describeStripDay } from "@keylow/core/copy";

import type { PlateStripProps } from "./types";

import { MacroProgressStrip, MacroProgressStripSkeleton } from "@/components/ui/MacroProgressStrip";
import { usePlate } from "@/lib/plate";

/**
 * The day's four bars for the dialog's strip slot: what was eaten and, after it, the share the plate adds. It only
 * tells, because leaving for Targets would drop the plate. Until the day, its targets and the time zone are read
 * it holds the strip's place with a skeleton of the same height, so the rows do not move.
 */
export function PlateStrip({ dayBars }: PlateStripProps) {
  const { count } = usePlate();

  if (dayBars.status === "loading") {
    return <MacroProgressStripSkeleton />;
  }

  return (
    <MacroProgressStrip
      bars={dayBars.bars}
      surface="sheet"
      label={describeStripDay(dayBars.dayTitle, count > 0)}
    />
  );
}
