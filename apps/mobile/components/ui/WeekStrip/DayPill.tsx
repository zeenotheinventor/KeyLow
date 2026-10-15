import { describeWeekStripDay } from "@keylow/core/copy";
import { View } from "react-native";

import { Icon } from "../Icon";
import { PressableSurface } from "../PressableSurface";
import { Text } from "../Text";

import type { DayPillProps } from "./types";

// The classes are written out so Tailwind sees them. The chosen day is filled and takes the strong border.
const pillLooks = {
  selected: "border-border-strong bg-surface-raised",
  other: "border-border",
};

// A pill is 56 high and its text must stay inside it at large text sizes: the date is 24 high and the day
// 16 high at their design sizes, so this keeps both from growing past the pill.
const maxFontScale = 1.2;

/** One day: its pill, and under it a 12 point row that holds today's dot or a complete day's tick. */
export function DayPill({ dateNumber, dayName, state, isFuture, onPress }: DayPillProps) {
  const look = pillLooks[state.isSelected ? "selected" : "other"];

  return (
    <View className="flex-1 items-center gap-1" testID="day-column">
      {/* The pill is the pressable itself, 48 wide at most, so its whole face is the touch target. */}
      <View className="w-full max-w-[48px]" testID="day-pill-slot">
        <PressableSurface
          className={`h-[56px] items-center justify-center gap-[2px] rounded-pill border ${look} ${isFuture ? "opacity-40" : ""}`}
          disabled={isFuture}
          label={describeWeekStripDay(state.localDate, state)}
          selected={state.isSelected}
          onPress={onPress}
        >
          <Text maxFontSizeMultiplier={maxFontScale} variant="body-strong">
            {dateNumber}
          </Text>
          <Text maxFontSizeMultiplier={maxFontScale} tone="muted" variant="caption">
            {dayName}
          </Text>
        </PressableSurface>
      </View>
      <View className="h-3 items-center justify-center" testID="day-status">
        {state.isComplete ? (
          <View testID="complete-tick">
            <Icon name="Check" size={12} strokeWidth={2.5} tone="success" />
          </View>
        ) : state.isToday ? (
          <View aria-hidden className="h-[6px] w-[6px] rounded-full bg-accent" testID="today-dot" />
        ) : null}
      </View>
    </View>
  );
}
