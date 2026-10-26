import { TIME_ROW_LABEL, describeTimeRowName, describeTimeValue } from "@keylow/core/copy";
import { View } from "react-native";

import { Icon } from "../Icon";
import { PressableSurface } from "../PressableSurface";
import { Text } from "../Text";

import type { TimeRowProps } from "./types";

/**
 * The field-style row that shows the time of an entry and opens the time picker, wherever a person can
 * change it: the portion picker, quick add and an entry's edit screen. "Time" on the left, the time on the
 * right in tabular numerals and a chevron at the end, on a raised surface that is at least 44 high. The
 * border turns accent while the picker is open. The screen keeps the time and the picker's state.
 */
export function TimeRow({
  time,
  isNow = false,
  open = false,
  disabled = false,
  onPress,
}: TimeRowProps) {
  return (
    <PressableSurface
      // The classes are written out so Tailwind sees them. The border is always there, so the row keeps its size.
      className={`min-h-touch-target flex-row items-center gap-2 rounded-medium border bg-surface-raised pl-4 pr-3 ${open ? "border-accent" : "border-border"} ${disabled ? "opacity-40" : ""}`}
      disabled={disabled}
      expanded={open}
      label={describeTimeRowName(time, isNow)}
      onPress={onPress}
    >
      <Text className="flex-1">{TIME_ROW_LABEL}</Text>
      <Text>{describeTimeValue(time, isNow)}</Text>
      <View aria-hidden>
        <Icon name="ChevronRight" size="sm" tone="muted" />
      </View>
    </PressableSurface>
  );
}
