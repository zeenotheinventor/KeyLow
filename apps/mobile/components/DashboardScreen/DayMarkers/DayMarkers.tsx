import { WEEK_STRIP_DAY_NAMES, describeWeekStripDay } from "@keylow/core/copy";
import { Text as NativeText, View } from "react-native";

import { Icon } from "../../ui";

import type { DayMarkersProps } from "./types";
import type { WeekDayMarker } from "@keylow/core/diary";

type MarkerLook = "complete" | "open" | "upcoming";

// The classes are written out so Tailwind sees them. A complete day is filled, a day so far that is open
// is a ring, and a day still to come is a dashed ring (the column is dimmed as well).
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
 * ring is named by its day and whether it is today or complete, as the week strip's pills are. The
 * letters are a caption at the weight the board gives them (regular, and semibold for today), which is
 * no text variant's, so they are set here.
 */
export function DayMarkers({ markers }: DayMarkersProps) {
  return (
    <View className="flex-row">
      {markers.map((marker, index) => {
        const look = lookOf(marker);
        const isToday = marker.state === "today";

        return (
          <View
            key={marker.localDate}
            className={`flex-1 items-center gap-1 ${look === "upcoming" ? "opacity-40" : ""}`}
          >
            <NativeText
              className={`text-caption tabular-nums ${isToday ? "font-semibold text-text-primary" : "font-normal text-text-secondary"}`}
            >
              {WEEK_STRIP_DAY_NAMES[index]}
            </NativeText>
            <View
              accessible
              aria-label={describeWeekStripDay(marker.localDate, {
                isToday,
                isComplete: look === "complete",
              })}
              className={`h-5 w-5 items-center justify-center rounded-full ${ringClassName[look]}`}
              role="img"
            >
              {look === "complete" ? (
                <View testID="marker-tick">
                  <Icon name="Check" size={12} strokeWidth={2.5} tone="success" />
                </View>
              ) : null}
            </View>
            <View aria-hidden className={`h-1 w-1 rounded-full ${isToday ? "bg-accent" : ""}`} />
          </View>
        );
      })}
    </View>
  );
}
