import { View } from "react-native";

import { Icon, PressableSurface, Text } from "../../ui";

import type { WeekDayLook, WeekDayProps } from "./types";

// The classes are written out so Tailwind sees them. A tick sits on the success fill, a session in progress
// on the accent fill inside the accent ring, and the ring alone marks today. A day still to come is a
// dashed ring and a rest day has no ring.
const markClassName: Record<WeekDayLook, string> = {
  done: "bg-success-muted",
  running: "border-2 border-accent bg-accent-muted",
  ring: "border-2 border-accent",
  planned: "border-[1.5px] border-dashed border-text-muted",
  rest: "",
};

// A day that is logged or in progress is named in the primary colour, one still to come in the secondary.
const labelIsPrimary: Record<WeekDayLook, boolean> = {
  done: true,
  running: true,
  ring: false,
  planned: false,
  rest: false,
};

const itemClassName = "min-h-[64px] items-center gap-1";

/**
 * One day of the week strip: its short name, a 28 point mark and the name of what it holds. It is one item
 * for a screen reader that says the whole day. It is a button only when it is given what pressing it does
 * (`onPress`), as a logged day is, and otherwise it only informs.
 */
export function WeekDay({ weekday, label, accessibleName, look, isToday, onPress }: WeekDayProps) {
  const contents = (
    <>
      <Text
        className={isToday ? "font-semibold" : ""}
        tone={isToday ? "primary" : "secondary"}
        variant="caption"
      >
        {weekday}
      </Text>
      {/* The mark is decorative inside an item that names the day, so it has no accessible identity of its own.
          The tick's wrapper is only there for the tests (Icon takes no testID): the name carries the state in words. */}
      <View
        className={`h-[28px] w-[28px] items-center justify-center rounded-full ${markClassName[look]}`}
        testID="week-day-mark"
      >
        {look === "done" ? (
          <View testID="week-day-check">
            <Icon name="Check" size={16} strokeWidth={2.25} tone="success-ink" />
          </View>
        ) : null}
        {look === "rest" ? (
          <View className="h-[2px] w-[8px] rounded-[1px] bg-text-muted" testID="week-day-dash" />
        ) : null}
      </View>
      {label === "" ? null : (
        <Text
          numberOfLines={1}
          tone={labelIsPrimary[look] ? "primary" : "secondary"}
          variant="caption"
        >
          {label}
        </Text>
      )}
    </>
  );

  return (
    <View className="min-w-0 flex-1">
      {onPress === undefined ? (
        <View accessible aria-label={accessibleName} className={itemClassName}>
          {contents}
        </View>
      ) : (
        <PressableSurface className={itemClassName} label={accessibleName} onPress={onPress}>
          {contents}
        </PressableSurface>
      )}
    </View>
  );
}
