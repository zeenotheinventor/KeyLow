import { useRoutine } from "@keylow/api-client";
import {
  GENERIC_ERROR,
  RETRY_LABEL,
  ROUTINE_EDITOR,
  ROUTINE_EDITOR_LOADING_LABEL,
} from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { useEffect } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { leaveRoutineEditor } from "../../lib/leaveRoutineEditor";
import { routinesPath } from "../../lib/routineRoutes";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { RoutineEditor } from "../RoutineEditor";
import { ErrorState, SheetHeader } from "../ui";

import type { ExerciseNames } from "../RoutineEditor";
import type { RoutineEditorScreenProps } from "./types";
import type { RoutineDraft } from "@keylow/core/training";

type StoredRoutine = NonNullable<ReturnType<typeof useRoutine>["data"]>;

/** A stored routine as the editor's draft: the days and exercises in order, with only the columns the draft holds. */
const draftOfStoredRoutine = (routine: StoredRoutine): RoutineDraft => ({
  name: routine.name,
  days: routine.days.map((day) => ({
    id: day.id,
    weekday: day.weekday,
    name: day.name,
    exercises: day.exercises.map((exercise) => ({
      exercise_id: exercise.exercise_id,
      target_sets: exercise.target_sets,
      rep_min: exercise.rep_min,
      rep_max: exercise.rep_max,
      target_rir: exercise.target_rir,
    })),
  })),
});

/** The names of a stored routine's exercises, by exercise id, which the draft does not hold. */
const exerciseNamesOf = (routine: StoredRoutine): ExerciseNames =>
  Object.fromEntries(
    routine.days.flatMap((day) =>
      day.exercises.map((exercise) => [exercise.exercise_id, exercise.exercise.name]),
    ),
  );

/**
 * `/train/routines/<id>`: opens the editor on a stored routine, read from the library and kept on the phone,
 * so it opens without a connection. The editor takes the routine as it was when the screen opened, so a
 * refetch under it never changes what the person is typing. A routine that is not there, or an address
 * that is not a routine's id, goes to the routines list, which it pops back to when it is already under
 * this screen. While the routine loads (or waits for a connection) the header shows with a loading status,
 * so Cancel editing is always there. A failed read says so and offers to try again.
 */
export function RoutineEditorScreen({ id }: RoutineEditorScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const routine = useRoutine(id, { enabled: useReadsEnabled() });
  // An address that is not an id never reaches the database: the read refuses it with a RangeError.
  const isMissing =
    id === undefined || routine.data === null || routine.error instanceof RangeError;

  useEffect(() => {
    if (isMissing) {
      router.dismissTo(routinesPath());
    }
  }, [isMissing, router]);

  if (routine.data !== undefined && routine.data !== null) {
    return (
      <RoutineEditor
        key={routine.data.id}
        exerciseNames={exerciseNamesOf(routine.data)}
        initialDraft={draftOfStoredRoutine(routine.data)}
        routineId={routine.data.id}
      />
    );
  }

  return (
    // The top inset is a runtime value no class can name, so it goes through a variable, as the routines list's does.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <SheetHeader
        leading={{
          icon: "ChevronLeft",
          label: ROUTINE_EDITOR.cancelLabel,
          onPress: () => {
            leaveRoutineEditor(router);
          },
        }}
        title={ROUTINE_EDITOR.title}
      />
      {routine.isError && !isMissing ? (
        <ErrorState
          retry={{
            label: RETRY_LABEL,
            onPress: () => {
              void routine.refetch();
            },
          }}
          title={GENERIC_ERROR}
        />
      ) : isMissing ? null : (
        <View
          accessible
          aria-label={ROUTINE_EDITOR_LOADING_LABEL}
          aria-live="polite"
          role="status"
        />
      )}
    </View>
  );
}
