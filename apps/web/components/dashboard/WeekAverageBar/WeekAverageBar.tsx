import {
  WEEK_AVERAGES,
  WEEK_GRID,
  describeOverTargetKcal,
  describeWeekAverageBasis,
  describeWeekAverageValue,
  describeWeekGridBarValue,
} from "@keylow/core/copy";
import { formatCalories } from "@keylow/core/format";

import type { WeekAverageBarProps } from "./types";

import { overTargetOutlineOnSurface } from "@/components/ui/MacroProgressStrip";
import { useWhipFill } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { vars } from "@/lib/vars";

// The fill eases in with the whip curve over the chart duration, as the macro bars do, and sits still under
// reduced motion.
const fillMotion = "transition-[width] duration-chart ease-whip motion-reduce:transition-none";

/**
 * The week's average calories against the target, as one calories row of the macro bars' look: the
 * label and the value over an 8 px bar, then what the average is taken over. The card and the weekly
 * averages page both average Monday to yesterday, so the caption is always "Mon to yesterday". Past the
 * target the bar is full and gains a brighter outline of its own colour (ruling 17) and the overshoot is
 * printed in the primary text, never in a warning colour. With no target the value stands alone and there
 * is no bar. The bar is a meter, so a screen reader finds it by its name.
 */
export function WeekAverageBar({
  averageKcal,
  targetKcal,
  barFill,
  kcalOverTarget,
  daysLogged,
}: WeekAverageBarProps) {
  const filled = useWhipFill(barFill ?? 0);
  const value = formatCalories(averageKcal);
  // "1,681 / 2,200 kcal" or "1,681 kcal": what follows the value is the muted part.
  const againstTarget = describeWeekAverageValue(averageKcal, targetKcal)
    .slice(value.length)
    .trim();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <span className="whitespace-nowrap text-caption text-text-secondary">
          {WEEK_GRID.average}
          <span className="text-text-muted"> · {WEEK_AVERAGES.rangeCaption}</span>
        </span>
        <span className="flex items-baseline gap-1 whitespace-nowrap tabular-nums">
          <span className="text-body-strong">{value}</span>
          <span className="text-caption text-text-muted">{againstTarget}</span>
          {kcalOverTarget !== null && (
            <span className="text-caption text-text-primary">
              {describeOverTargetKcal(kcalOverTarget)}
            </span>
          )}
        </span>
      </div>
      {targetKcal !== null && (
        <span
          role="meter"
          aria-label={WEEK_GRID.average}
          aria-valuemin={0}
          aria-valuemax={targetKcal}
          aria-valuenow={Math.round(Math.min(averageKcal, targetKcal))}
          aria-valuetext={describeWeekGridBarValue(averageKcal, targetKcal)}
          // The fill's share is runtime data, so it reaches the class as a custom property.
          style={vars({ "--fill": `${filled * 100}%` })}
          className={cn(
            "relative block h-2 overflow-hidden rounded-pill bg-border",
            kcalOverTarget !== null && overTargetOutlineOnSurface.calories,
          )}
        >
          <span
            role="presentation"
            className={cn(
              "absolute inset-y-0 left-0 w-[var(--fill)] rounded-[inherit] bg-calories",
              fillMotion,
            )}
          />
        </span>
      )}
      <span className="text-caption text-text-muted">{describeWeekAverageBasis(daysLogged)}</span>
    </div>
  );
}
