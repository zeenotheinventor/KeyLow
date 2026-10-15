import { describeDatePickerDay } from "@keylow/core/copy";

import type { DayCellProps } from "./types";

import { cn } from "@/lib/utils";

// A 44 px circle, which is the board's cell and a real touch target. The ring on today is a 2 px
// border so it does not compete with the keyboard focus ring, which is a shadow. The selected day is
// filled. Every class is written out so Tailwind sees it.
const cellClassName =
  "relative flex size-11 items-center justify-center rounded-pill border-2 border-transparent p-0 text-body tabular-nums text-text-primary outline-none transition-colors duration-quick hover:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none";
const selectedClassName = "bg-accent font-semibold text-accent-foreground hover:bg-accent";
const todayClassName = "border-accent";

/** One day of the month grid: its number, a ring when it is today, a fill when it is selected and a dot when it is complete. */
export function DayCell({
  localDate,
  isToday,
  isSelected,
  isComplete,
  isFuture,
  isTabStop,
  buttonRef,
  onKeyDown,
  onPress,
}: DayCellProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={describeDatePickerDay(localDate, { isToday, isSelected, isComplete })}
      aria-pressed={isSelected}
      tabIndex={isTabStop ? 0 : -1}
      disabled={isFuture}
      className={cn(cellClassName, isToday && todayClassName, isSelected && selectedClassName)}
      onClick={onPress}
      onKeyDown={onKeyDown}
    >
      {String(Number(localDate.slice(-2)))}
      {isComplete && (
        <span
          aria-hidden
          className="absolute bottom-[3px] left-1/2 size-1 -translate-x-1/2 rounded-pill bg-success"
        />
      )}
    </button>
  );
}
