import { describeDatePickerDay } from "@keylow/core/copy";
import { View } from "react-native";

import { PressableSurface } from "../../PressableSurface";
import { Text } from "../../Text";

import type { DateCellProps } from "./types";

// The classes are written out so Tailwind sees them. Today is ringed in the accent and the chosen day is
// filled with it, so today chosen is both. A future day is dimmed to 40 percent.
const cellClassName = {
  base: "h-[44px] w-[44px] items-center justify-center rounded-full border-2",
  today: "border-accent",
  notToday: "border-transparent",
  selected: "bg-accent",
  future: "opacity-40",
};

/**
 * One day of the month grid: a 44 point circle with its number, and a success dot under it when the day is
 * complete. The chosen day says so in its name, as the board and the web picker do.
 */
export function DateCell({
  localDate,
  isToday,
  isSelected,
  isComplete,
  isFuture,
  onPress,
}: DateCellProps) {
  const dayOfMonth = String(Number(localDate.slice(-2)));

  return (
    <PressableSurface
      className={`${cellClassName.base} ${isToday ? cellClassName.today : cellClassName.notToday} ${isSelected ? cellClassName.selected : ""} ${isFuture ? cellClassName.future : ""}`}
      disabled={isFuture}
      label={describeDatePickerDay(localDate, { isToday, isSelected, isComplete })}
      onPress={onPress}
    >
      <Text
        tone={isSelected ? "accent-foreground" : "primary"}
        variant={isSelected ? "body-strong" : "body"}
      >
        {dayOfMonth}
      </Text>
      {isComplete ? (
        <View
          aria-hidden
          className="absolute bottom-[5px] left-1/2 -ml-[2px] h-[4px] w-[4px] rounded-full bg-success"
          testID="complete-dot"
        />
      ) : null}
    </PressableSurface>
  );
}
