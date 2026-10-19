import { ROUTINE_EDITOR } from "@keylow/core/copy";
import { View } from "react-native";

import { RoutineExerciseRow } from "../RoutineExerciseRow";
import { Button, Text } from "../ui";

import type { RoutineDayExercisesProps } from "./types";

/**
 * The body of an open day in the routine editor, as the `routines · editor` board draws it under the
 * day's header: the column heads (Exercise, Sets, Reps, RIR), a row for each exercise, and Add exercise.
 * The column heads are for the eye, because every field is named with its exercise.
 */
export function RoutineDayExercises({
  exercises,
  isFull,
  marks,
  registerRow,
  onChangeField,
  onOpenMenu,
  onAdd,
}: RoutineDayExercisesProps) {
  return (
    <View>
      {/* The remove control's 36 points have no head over them, and the three columns are the rows' own. */}
      <View
        aria-hidden
        className="flex-row items-center gap-[6px] border-t border-border px-3 py-1"
        importantForAccessibility="no-hide-descendants"
      >
        <Text className="min-w-0 flex-1" tone="muted" variant="caption">
          {ROUTINE_EDITOR.exerciseHeading}
        </Text>
        <Text className="w-[48px] text-center" tone="muted" variant="caption">
          {ROUTINE_EDITOR.setsHeading}
        </Text>
        <Text className="w-[84px] text-center" tone="muted" variant="caption">
          {ROUTINE_EDITOR.repsHeading}
        </Text>
        <Text className="w-[48px] text-center" tone="muted" variant="caption">
          {ROUTINE_EDITOR.rirHeading}
        </Text>
        <View className="w-[36px]" />
      </View>
      {exercises.map((exercise, position) => (
        <RoutineExerciseRow
          key={exercise.key}
          marks={marks?.[position]}
          name={exercise.name}
          rowRef={registerRow?.(exercise.key)}
          repsText={exercise.repsText}
          rirText={exercise.rirText}
          setsText={exercise.setsText}
          onChangeField={(field, text) => {
            onChangeField(exercise.key, field, text);
          }}
          onOpenMenu={() => {
            onOpenMenu(exercise.key);
          }}
        />
      ))}
      <Button
        className="mx-2 my-1 self-start"
        disabled={isFull}
        icon="Plus"
        size="sm"
        tone="accent-ink"
        variant="ghost"
        onPress={onAdd}
      >
        {ROUTINE_EDITOR.addExerciseAction}
      </Button>
    </View>
  );
}
