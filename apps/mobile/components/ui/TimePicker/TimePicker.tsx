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

type WheelsProps = Pick<TimePickerProps, "value" | "latest" | "onChange" | "onClose">;

const NO_LIMIT = { hour: HOURS_PER_DAY - 1, minute: MINUTES_PER_HOUR - 1 };

// The wheels and Done are the sheet's contents, so they are mounted with the sheet and the choice starts
// again from `value` each time it opens. That is also what makes dismissing it discard the change.
function Wheels({ value, latest, onChange, onClose }: WheelsProps) {
  const limit = (latest === undefined ? undefined : parseClockTime(latest)) ?? NO_LIMIT;
  const start = parseClockTime(value) ?? { hour: 0, minute: 0 };
  // A time after the latest one is not on offer, so a value past it opens on the latest time.
  const startsPastLimit =
    start.hour > limit.hour || (start.hour === limit.hour && start.minute > limit.minute);
  const [hour, setHour] = useState(startsPastLimit ? limit.hour : start.hour);
  const [minute, setMinute] = useState(startsPastLimit ? limit.minute : start.minute);
  const lastMinute = hour === limit.hour ? limit.minute : MINUTES_PER_HOUR - 1;

  function chooseHour(next: number) {
    setHour(next);
    // Moving to the latest hour takes the minute back to the latest minute, so the time is never after it.
    if (next === limit.hour) {
      setMinute(Math.min(minute, limit.minute));
    }
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-center gap-2">
        <TimeWheel count={limit.hour + 1} label="Hours" value={hour} onChange={chooseHour} />
        <Text aria-hidden tone="muted" variant="h2">
          :
        </Text>
        <TimeWheel count={lastMinute + 1} label="Minutes" value={minute} onChange={setMinute} />
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
 * time and closes the sheet. Any other way of closing it discards the change. With a `latest` time the
 * wheels stop at it: no hour after its hour is on offer, and in its hour no minute after its minute.
 */
export function TimePicker({ open, value, latest, onChange, onClose }: TimePickerProps) {
  return (
    // The wheels own their vertical drags, so the sheet must not take them.
    <BottomSheet isContentDraggable={false} open={open} title="Time" onClose={onClose}>
      <Wheels latest={latest} value={value} onChange={onChange} onClose={onClose} />
    </BottomSheet>
  );
}
