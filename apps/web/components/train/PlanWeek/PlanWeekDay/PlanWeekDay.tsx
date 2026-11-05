import type { PlanWeekDayProps } from "./types";
import type { WeekDayLook } from "@keylow/core/training";

import { cn } from "@/lib/utils";

// The classes are written out so Tailwind sees them, as the `web-train · today` board draws the days: the
// success fill for a logged day, the 2px accent ring for today, the 1.5px dashed ring for a day still to come
// and the 1px border for a rest day. A session in progress is the ring on the accent fill, as on mobile.
const lookClassName: Record<WeekDayLook, string> = {
  done: "border border-border bg-success-muted",
  running: "border-2 border-accent bg-accent-muted",
  ring: "border-2 border-accent bg-surface",
  planned: "border-[1.5px] border-dashed border-text-muted bg-surface",
  rest: "border border-border bg-surface",
};

/**
 * One day of the week strip: its short name and the name of what it holds, in a tile. The tile is one named
 * group for a screen reader that says the whole day. It only informs: the session detail turns a logged day
 * into a link.
 */
export function PlanWeekDay({ weekday, label, accessibleName, look, isToday }: PlanWeekDayProps) {
  return (
    <li className="min-w-0">
      <div
        role="group"
        aria-label={accessibleName}
        className={cn(
          "flex min-h-16 flex-col items-center justify-center gap-1 rounded-medium text-text-primary",
          lookClassName[look],
        )}
      >
        <span
          aria-hidden="true"
          className={cn("text-caption", isToday ? "font-bold" : "font-medium")}
        >
          {weekday}
        </span>
        {label === "" ? null : (
          <span aria-hidden="true" className="max-w-full truncate text-caption text-text-secondary">
            {label}
          </span>
        )}
      </div>
    </li>
  );
}
