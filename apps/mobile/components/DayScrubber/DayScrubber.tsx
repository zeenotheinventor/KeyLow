import { BODY_MAP } from "@keylow/core/copy";
import { View } from "react-native";

import { PressableSurface, Text } from "../ui";

import type { DayScrubberDot, DayScrubberProps } from "./types";

// The classes are written out so Tailwind sees them. A logged day is a filled dot, a session in progress an
// accent one and a planned day still to come a ring. A rest day and a missed one have no dot, so theirs is
// drawn clear and the numeral stays where it is on every day.
const dotClassName: Record<DayScrubberDot, string> = {
  logged: "border-text-secondary bg-text-secondary",
  running: "border-accent bg-accent",
  planned: "border-text-muted bg-transparent",
  none: "border-transparent bg-transparent",
};

// The chosen day takes the accent border and fill, as the boards draw it. A day that cannot be chosen is at
// 40 percent.
const looks = {
  selected: "border-accent bg-accent-muted",
  other: "border-border bg-surface",
};

/**
 * The row of seven days under the body map card: each is a button 52 points tall with the weekday, the day of
 * the month and a 6 point dot for what the day holds. The chosen day is the selected one, and a day that cannot
 * be chosen in the view shown is disabled and says why in its name. Each day is one item for a screen reader,
 * so the dot is decoration and the name carries what it means.
 */
export function DayScrubber({ days, selectedDate, onSelect }: DayScrubberProps) {
  return (
    <View aria-label={BODY_MAP.scrubber.name} className="flex-row gap-[6px]" role="group">
      {days.map(({ date, weekday, dayOfMonth, accessibleName, dot, isToday, isDisabled }) => (
        <View key={date} className="min-w-0 flex-1">
          <PressableSurface
            className={`h-[52px] items-center justify-center gap-[2px] rounded-medium border ${looks[date === selectedDate ? "selected" : "other"]} ${isDisabled ? "opacity-40" : ""}`}
            disabled={isDisabled}
            label={accessibleName}
            selected={date === selectedDate}
            onPress={() => {
              onSelect(date);
            }}
          >
            <Text
              className={isToday ? "font-semibold" : ""}
              tone={isToday ? "primary" : "secondary"}
              variant="caption"
            >
              {weekday}
            </Text>
            <Text className="!leading-[16px]" variant="label-small">
              {dayOfMonth}
            </Text>
            <View
              aria-hidden
              className={`h-[6px] w-[6px] rounded-full border-[1.5px] ${dotClassName[dot]}`}
            />
          </PressableSurface>
        </View>
      ))}
    </View>
  );
}
