import { joinClockTime, parseClockTime } from "@keylow/core/dates";
import { useState } from "react";
import { View } from "react-native";

import { BottomSheet } from "../BottomSheet";
import { Button } from "../Button";
import { Text } from "../Text";
import { TimeWheel } from "./TimeWheel";

import type { TimePickerProps } from "./types";

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;

type WheelsProps = Pick<TimePickerProps, "value" | "onChange" | "onClose">;

// The wheels and Done are the sheet's contents, so they are mounted with the sheet and the choice starts
// again from `value` each time it opens. That is also what makes dismissing it discard the change.
function Wheels({ value, onChange, onClose }: WheelsProps) {
  const start = parseClockTime(value) ?? { hour: 0, minute: 0 };
  const [hour, setHour] = useState(start.hour);
  const [minute, setMinute] = useState(start.minute);

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-center gap-2">
        <TimeWheel count={HOURS_PER_DAY} label="Hours" value={hour} onChange={setHour} />
        <Text aria-hidden tone="muted" variant="h2">
          :
        </Text>
        <TimeWheel count={MINUTES_PER_HOUR} label="Minutes" value={minute} onChange={setMinute} />
      </View>
      <Button
        fullWidth
        size="lg"
        onPress={() => {
          onChange(joinClockTime(hour, minute));
          onClose();
        }}
      >
        Done
      </Button>
    </View>
  );
}

/**
 * Picks a time of day on two wheels, hours 00 to 23 and minutes 00 to 59, in a bottom sheet titled Time. It
 * works in clock time only: turning it into an instant in the profile's zone is core's job. Done applies the
 * time and closes the sheet. Any other way of closing it discards the change.
 */
export function TimePicker({ open, value, onChange, onClose }: TimePickerProps) {
  return (
    <BottomSheet open={open} title="Time" onClose={onClose}>
      <Wheels value={value} onChange={onChange} onClose={onClose} />
    </BottomSheet>
  );
}
