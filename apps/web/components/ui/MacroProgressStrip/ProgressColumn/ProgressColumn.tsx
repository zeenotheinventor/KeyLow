import { MACRO_NAMES, describeProgressTarget, describeProgressValue } from "@keylow/core/copy";
import { Flame } from "lucide-react";

import {
  overTargetOutline,
  overTargetOutlineOnSheet,
  overTargetOutlineOnSurface,
} from "../overTargetOutline";

import type { ProgressColumnProps } from "./types";
import type { MacroProgressStripSurface } from "../types";
import type { ProgressBarKey } from "@keylow/core/diary";

import { cn } from "@/lib/utils";
import { vars } from "@/lib/vars";

// The classes are written out so Tailwind sees them.
const fillClassName: Record<ProgressBarKey, string> = {
  calories: "bg-calories",
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
};
// The plate's share is the same colour at 45 per cent.
const plateShareClassName: Record<ProgressBarKey, string> = {
  calories: "bg-calories/45",
  protein: "bg-protein/45",
  carbs: "bg-carbs/45",
  fat: "bg-fat/45",
};
const outlineBySurface: Record<MacroProgressStripSurface, Record<ProgressBarKey, string>> = {
  page: overTargetOutline,
  sheet: overTargetOutlineOnSheet,
  card: overTargetOutlineOnSurface,
};

/**
 * One column of the strip: the line of numbers, and under it a 4 px bar when there is a target. With
 * no target the line is the value and its unit alone and there is no bar. The bar is decoration inside
 * a button whose name already says the same in words, so it has no role and carries ids to find it by.
 */
export function ProgressColumn({ bar, surface }: ProgressColumnProps) {
  // "/ 2,200" against a target, or the unit with none. The unit stays in the value's own ink. The value is
  // what was eaten plus what the plate holds.
  const target = describeProgressTarget(bar);
  const value = describeProgressValue(bar);
  const eaten = bar.hasTarget ? value : `${value} ${target}`;

  return (
    <span className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-center gap-1 whitespace-nowrap text-caption tabular-nums text-text-primary">
        {bar.key === "calories" ? (
          <Flame
            aria-hidden
            data-testid="calories-flame"
            className="size-3 flex-none stroke-calories"
            strokeWidth={2}
          />
        ) : (
          <span className="text-text-secondary">{MACRO_NAMES[bar.key].charAt(0)}</span>
        )}
        <span>{eaten}</span>
        {bar.hasTarget && <span className="text-text-muted">{target}</span>}
      </span>
      {bar.hasTarget && (
        <span
          aria-hidden
          data-testid={`${bar.key}-bar`}
          className={cn(
            "relative block h-1 overflow-hidden rounded-pill bg-border",
            bar.isOver && outlineBySurface[surface][bar.key],
          )}
        >
          <span
            data-testid={`${bar.key}-fill`}
            // The fill's share is runtime data, so it reaches the class as a custom property.
            style={vars({ "--fill": `${bar.fillFraction * 100}%` })}
            className={cn("absolute inset-y-0 left-0 w-[var(--fill)]", fillClassName[bar.key])}
          />
          {bar.plateFillFraction > 0 && (
            <span
              data-testid={`${bar.key}-plate-fill`}
              // The plate's share starts where the eaten fill ends, and both are runtime data.
              style={vars({
                "--fill": `${bar.fillFraction * 100}%`,
                "--plate-fill": `${bar.plateFillFraction * 100}%`,
              })}
              className={cn(
                "absolute inset-y-0 left-[var(--fill)] w-[var(--plate-fill)]",
                plateShareClassName[bar.key],
              )}
            />
          )}
        </span>
      )}
    </span>
  );
}
