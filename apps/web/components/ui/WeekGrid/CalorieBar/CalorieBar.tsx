import { describeWeekGridBarValue } from "@keylow/core/copy";
import { barNumbers } from "@keylow/core/diary";

import type { CalorieBarProps } from "./types";

import { overTargetOutline } from "@/components/ui/MacroProgressStrip";
import { cn } from "@/lib/utils";
import { vars } from "@/lib/vars";

/**
 * A thin bar of a day's calories against the target, in the calories colour. Over target it is full
 * and takes a brighter outline of its own colour, never the warning or danger colour. It is a meter,
 * so a screen reader finds it by its name, and the numbers beside it say the same in words.
 */
export function CalorieBar({ label, kcal, target, className }: CalorieBarProps) {
  const { fillFraction, isOver } = barNumbers(kcal, target);

  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={Math.round(Math.min(kcal, target))}
      aria-valuetext={describeWeekGridBarValue(kcal, target)}
      // The fill's share is runtime data, so it reaches the class as a custom property.
      style={vars({ "--fill": `${fillFraction * 100}%` })}
      className={cn(
        "relative block h-1 overflow-hidden rounded-pill bg-border",
        isOver && overTargetOutline.calories,
        className,
      )}
    >
      <span role="presentation" className="absolute inset-y-0 left-0 w-[var(--fill)] bg-calories" />
    </span>
  );
}
