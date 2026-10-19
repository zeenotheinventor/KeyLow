import { View } from "react-native";

import { Icon, Text } from "../ui";
import { setColumnClassName } from "./columnClassName";

import type { SetRowProps } from "./types";
import type { SetRowState } from "@keylow/core/training";

// The classes are written out so Tailwind sees them. A done row has the success tint, its fields lose their
// fill and its numbers are the primary ink; the next row and a row to do are drawn alike, in raised fields
// with muted numbers, as the `session · active` board draws them.
const rowClassName: Record<SetRowState, string> = {
  done: "bg-success-muted",
  next: "bg-transparent",
  todo: "bg-transparent",
};

const fieldClassName: Record<SetRowState, string> = {
  done: "bg-transparent",
  next: "bg-surface-raised",
  todo: "bg-surface-raised",
};

const checkClassName: Record<SetRowState, string> = {
  done: "border-success bg-success",
  next: "border-border bg-surface-raised",
  todo: "border-border bg-surface-raised",
};

const fieldBaseClassName = "h-9 items-center justify-center rounded-small";

/**
 * One set of an exercise, as the `session · active` board draws it: the set's mark (W for a warm-up), what the
 * same set made last time, the load, the reps and the RIR, and the check. It only displays: the check is not a
 * button yet, so it is drawn with its accessible name and no role, until the ticket that logs a set makes it
 * one. Every word is `describeSetRow`'s.
 */
export function SetRow({ state, setType, copy }: SetRowProps) {
  const isDone = state === "done";
  const valueTone = isDone ? "primary" : "muted";

  return (
    <View
      className={`min-h-11 flex-row items-center ${setColumnClassName.row} ${rowClassName[state]}`}
      role="listitem"
    >
      <Text
        className={setColumnClassName.mark}
        tone={setType === "warmup" ? "warning-ink" : "secondary"}
        variant="label-small"
      >
        {copy.label}
      </Text>
      <Text
        className={setColumnClassName.previous}
        numberOfLines={1}
        tone="muted"
        variant="caption"
      >
        {copy.previous}
      </Text>
      <View className={`${setColumnClassName.load} ${fieldBaseClassName} ${fieldClassName[state]}`}>
        <Text tone={valueTone} variant="body-strong">
          {copy.load}
        </Text>
      </View>
      <View className={`${setColumnClassName.reps} ${fieldBaseClassName} ${fieldClassName[state]}`}>
        <Text tone={valueTone} variant="body-strong">
          {copy.reps}
        </Text>
      </View>
      <View className={`${setColumnClassName.rir} ${fieldBaseClassName} ${fieldClassName[state]}`}>
        <Text tone={valueTone} variant="body-strong">
          {copy.rir}
        </Text>
      </View>
      <View
        accessible
        aria-label={copy.accessibleName}
        className={`h-10 ${setColumnClassName.check} items-center justify-center rounded-small border ${checkClassName[state]}`}
      >
        <Icon name="Check" size={18} strokeWidth={2.25} tone={isDone ? "on-status" : "muted"} />
      </View>
    </View>
  );
}
