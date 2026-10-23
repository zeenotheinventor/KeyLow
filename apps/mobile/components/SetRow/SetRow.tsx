import { View } from "react-native";

import { Icon, PressableSurface, Text } from "../ui";
import { setColumnClassName } from "./columnClassName";
import { ReadOnlySetRow } from "./ReadOnlySetRow";

import type { ActiveSetRowProps, SetRowProps } from "./types";
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
 * same set made last time, the load, the reps and the RIR, and the check. The check is a button when the
 * row is given what it does (`onCheck`), named as `describeSetRow` names it; without one it is drawn with its
 * accessible name and no role. A set still to do has its load, reps and RIR cells as one button that opens
 * the set entry (`edit`); a row without it only displays. A logged set's mark is a button that opens the set
 * types sheet when the row is given what it does (`typeEdit`). Every word is `describeSetRow`'s. With
 * `variant="readOnly"` it is a set of a logged session instead (`ReadOnlySetRow`).
 */
export function SetRow(props: SetRowProps) {
  if (props.variant === "readOnly") {
    return <ReadOnlySetRow {...props} />;
  }
  return <ActiveSetRow {...props} />;
}

function ActiveSetRow({ state, setType, copy, edit, typeEdit, onCheck }: ActiveSetRowProps) {
  const isDone = state === "done";
  const markTone = setType === "warmup" ? "warning-ink" : "secondary";
  const valueTone = isDone ? "primary" : "muted";
  const checkBoxClassName = `h-10 ${setColumnClassName.check} items-center justify-center rounded-small border ${checkClassName[state]}`;
  const checkIcon = (
    <Icon name="Check" size={18} strokeWidth={2.25} tone={isDone ? "on-status" : "muted"} />
  );

  const cells = (
    <>
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
    </>
  );

  return (
    <View
      className={`min-h-11 flex-row items-center ${setColumnClassName.row} ${rowClassName[state]}`}
      role="listitem"
    >
      {typeEdit === undefined ? (
        <Text className={setColumnClassName.mark} tone={markTone} variant="label-small">
          {copy.label}
        </Text>
      ) : (
        // The mark's column is 32 points wide and the row 44 high, so the slop reaches the 44 point target.
        <PressableSurface
          className={`h-8 justify-center ${setColumnClassName.mark}`}
          hitSlop={6}
          label={typeEdit.name}
          onPress={typeEdit.onPress}
        >
          <Text tone={markTone} variant="label-small">
            {copy.label}
          </Text>
        </PressableSurface>
      )}
      <Text
        className={setColumnClassName.previous}
        numberOfLines={1}
        tone="muted"
        variant="caption"
      >
        {copy.previous}
      </Text>
      {edit === undefined ? (
        <View className="flex-row gap-[6px]">{cells}</View>
      ) : (
        // The cells are 36 points high, so the button reaches the 44 point target through its hit slop.
        <PressableSurface
          className="flex-row gap-[6px]"
          hitSlop={{ top: 4, bottom: 4 }}
          label={edit.name}
          onPress={edit.onPress}
        >
          {cells}
        </PressableSurface>
      )}
      {onCheck === undefined ? (
        <View accessible aria-label={copy.accessibleName} className={checkBoxClassName}>
          {checkIcon}
        </View>
      ) : (
        // The box is 40 points inside a 44 point row, so the slop reaches the 44 point touch target. The
        // press overlay fills the box, so the box clips it to its rounded corners.
        <PressableSurface
          className={`overflow-hidden ${checkBoxClassName}`}
          hitSlop={2}
          label={copy.accessibleName}
          onPress={onCheck}
        >
          {checkIcon}
        </PressableSurface>
      )}
    </View>
  );
}
