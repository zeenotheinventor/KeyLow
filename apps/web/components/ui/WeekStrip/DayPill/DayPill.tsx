import { describeWeekStripDay } from "@keylow/core/copy";
import { Check } from "lucide-react";

import type { DayPillProps } from "./types";

import { cn } from "@/lib/utils";

// The classes are written out so Tailwind sees them. The chosen day is filled and takes the strong border.
const pillClassName =
  "flex h-14 w-full flex-col items-center justify-center rounded-pill border p-0 font-sans text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset";
const selectedLook = "border-border-strong bg-surface-raised";
const otherLook = "border-border";

/**
 * One day: its pill, and under it a 12 px row that holds today's accent dot or a complete day's check. A
 * day after today stays a tab stop but is `aria-disabled` and does nothing, so a keyboard user hears why.
 * The dot and the check are decoration: the pill's name already says "today" and "complete".
 */
export function DayPill({
  localDate,
  dateNumber,
  dayName,
  isToday,
  isSelected,
  isComplete,
  isFuture,
  onPress,
}: DayPillProps) {
  return (
    <span className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label={describeWeekStripDay(localDate, { isToday, isComplete })}
        aria-pressed={isSelected}
        aria-disabled={isFuture}
        className={cn(
          pillClassName,
          isSelected ? selectedLook : otherLook,
          isFuture && "opacity-50",
        )}
        onClick={() => {
          if (!isFuture) {
            onPress();
          }
        }}
      >
        <span className="text-body-strong tabular-nums">{dateNumber}</span>
        <span className="text-caption text-text-secondary">{dayName}</span>
      </button>
      <span className="flex h-3 items-center">
        {isComplete ? (
          <Check
            aria-hidden
            data-testid="complete-check"
            className="size-3 stroke-success"
            strokeWidth={2.5}
          />
        ) : (
          isToday && (
            <span aria-hidden data-testid="today-dot" className="size-1.5 rounded-full bg-accent" />
          )
        )}
      </span>
    </span>
  );
}
