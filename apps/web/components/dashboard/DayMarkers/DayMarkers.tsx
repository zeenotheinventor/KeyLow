import { WEEK_STRIP_DAY_NAMES, describeWeekStripDay } from "@keylow/core/copy";
import { Check } from "lucide-react";

import type { DayMarkersProps } from "./types";
import type { WeekDayMarker } from "@keylow/core/diary";

import { cn } from "@/lib/utils";

type MarkerLook = "complete" | "open" | "upcoming";

// The classes are written out so Tailwind sees them. A complete day is filled, a day so far that is open is
// a ring, and a day still to come is a dashed ring (the column is dimmed as well).
const ringClassName: Record<MarkerLook, string> = {
  complete: "bg-success-muted",
  open: "border-[1.5px] border-border-strong",
  upcoming: "border-[1.5px] border-dashed border-border-strong",
};

function lookOf(marker: WeekDayMarker): MarkerLook {
  if (marker.state === "upcoming") {
    return "upcoming";
  }
  const isComplete = marker.state === "complete" || (marker.state === "today" && marker.isComplete);

  return isComplete ? "complete" : "open";
}

/**
 * The seven days of the week as small markers, Monday to Sunday, drawn from the week strip's pill states
 * but compact and not pressable: a complete day is filled with a check, an open day so far is a ring,
 * today has its letters in strong text and a dot under it, and a day to come is dashed and dimmed. Each
 * ring is named by its day and whether it is today or complete, as the week strip's pills are.
 */
export function DayMarkers({ markers }: DayMarkersProps) {
  return (
    <ol className="grid grid-cols-7">
      {markers.map((marker, index) => {
        const look = lookOf(marker);
        const isToday = marker.state === "today";

        return (
          <li
            key={marker.localDate}
            className={cn("flex flex-col items-center gap-1", look === "upcoming" && "opacity-40")}
          >
            <span
              className={cn(
                "text-caption",
                isToday ? "font-semibold text-text-primary" : "font-normal text-text-secondary",
              )}
            >
              {WEEK_STRIP_DAY_NAMES[index]}
            </span>
            <span
              role="img"
              aria-label={describeWeekStripDay(marker.localDate, {
                isToday,
                isComplete: look === "complete",
              })}
              className={cn(
                "flex size-5 items-center justify-center rounded-full",
                ringClassName[look],
              )}
            >
              {look === "complete" && (
                <Check aria-hidden className="size-3 stroke-success" strokeWidth={2.5} />
              )}
            </span>
            <span
              aria-hidden
              className={cn("size-1 rounded-full", isToday ? "bg-accent" : "bg-transparent")}
            />
          </li>
        );
      })}
    </ol>
  );
}
