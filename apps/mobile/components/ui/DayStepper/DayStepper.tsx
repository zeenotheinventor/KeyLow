import { DAY_STEPPER, addDays, describeDay } from "@keylow/core";
import { useState } from "react";
import { View } from "react-native";

import { IconButton } from "../IconButton";
import { PressableSurface } from "../PressableSurface";
import { Text } from "../Text";
import { WipeInLabel } from "./WipeInLabel";

import type { DayStepperProps } from "./types";

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Moves the diary between days: previous, the day's label, next and a date picker. The label cuts in
 * when the day changes, from the other side when stepping back. Next is disabled on and after today. A
 * step plays the selection haptic.
 */
export function DayStepper({
  date,
  today = new Date(),
  timeZone = deviceTimeZone(),
  onChange,
  onPickDate,
  className = "",
}: DayStepperProps) {
  // Stepping back cuts the label in from the other side.
  const [isStepBack, setIsStepBack] = useState(false);
  const { label, subLine, pickerName, daysFromToday } = describeDay(date, today, timeZone);

  const step = (days: -1 | 1) => {
    setIsStepBack(days < 0);
    onChange?.(addDays(date, days, timeZone));
  };

  return (
    <View className={`flex-row items-center gap-2 ${className}`}>
      <IconButton
        haptic="select"
        icon="ChevronLeft"
        label={DAY_STEPPER.previousDay}
        onPress={() => {
          step(-1);
        }}
      />
      {/* The label button has no fill, and it clips the label while it cuts in. */}
      <View className="min-w-0 flex-1">
        <PressableSurface
          className="min-h-touch-target items-center justify-center overflow-hidden"
          label={pickerName}
          onPress={onPickDate}
        >
          <WipeInLabel key={label} isStepBack={isStepBack}>
            {label}
          </WipeInLabel>
          <Text variant="caption" tone="muted">
            {subLine}
          </Text>
        </PressableSurface>
      </View>
      <IconButton
        disabled={daysFromToday >= 0}
        haptic="select"
        icon="ChevronRight"
        label={DAY_STEPPER.nextDay}
        onPress={() => {
          step(1);
        }}
      />
      <IconButton
        icon="Calendar"
        label={DAY_STEPPER.chooseDate}
        onPress={() => {
          onPickDate?.();
        }}
      />
    </View>
  );
}
