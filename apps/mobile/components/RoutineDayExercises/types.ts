import type { EditorExercise, ExerciseField, ExerciseMarks } from "../RoutineEditor";
import type { RefCallback } from "react";
import type { View } from "react-native";

export type RoutineDayExercisesProps = {
  /** The day's exercises, in order. */
  exercises: readonly EditorExercise[];
  /** Stops Add exercise when the day holds all it can. */
  isFull: boolean;
  /** What is wrong with each exercise's fields, by position, or undefined when nothing is. */
  marks?: readonly (ExerciseMarks | undefined)[] | undefined;
  /** Gives the ref callback for the row of the exercise with this key, so the screen can scroll to it. */
  registerRow?: ((key: number) => RefCallback<View>) | undefined;
  onChangeField: (key: number, field: ExerciseField, text: string) => void;
  /** Opens the menu of the exercise with this key. */
  onOpenMenu: (key: number) => void;
  /** Opens the picker for this day. */
  onAdd: () => void;
};
