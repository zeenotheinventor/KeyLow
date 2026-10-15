import { MACRO_NAMES, describeProgressTarget } from "@keylow/core/copy";
import { formatCalories, formatGrams } from "@keylow/core/format";
import { Flame } from "lucide-react";

import { overTargetOutline } from "../overTargetOutline";

import type { ProgressColumnProps } from "./types";
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

/**
 * One column of the strip: the line of numbers, and under it a 4 px bar when there is a target. With
 * no target the line is the value and its unit alone and there is no bar. The bar is decoration inside
 * a button whose name already says the same in words, so it has no role and carries ids to find it by.
 */
export function ProgressColumn({ bar }: ProgressColumnProps) {
  const isCalories = bar.key === "calories";
  const format = isCalories ? formatCalories : formatGrams;
  // "/ 2,200" against a target, or the unit with none. The unit stays in the value's own ink.
  const target = describeProgressTarget(bar);
  const eaten = bar.hasTarget ? format(bar.eaten) : `${format(bar.eaten)} ${target}`;

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
            bar.isOver && overTargetOutline[bar.key],
          )}
        >
          <span
            data-testid={`${bar.key}-fill`}
            // The fill's share is runtime data, so it reaches the class as a custom property.
            style={vars({ "--fill": `${bar.fillFraction * 100}%` })}
            className={cn("absolute inset-y-0 left-0 w-[var(--fill)]", fillClassName[bar.key])}
          />
        </span>
      )}
    </span>
  );
}
