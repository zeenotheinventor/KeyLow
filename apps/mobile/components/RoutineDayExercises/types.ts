import type { EditorExercise, ExerciseField } from "../RoutineEditor";

export type RoutineDayExercisesProps = {
  /** The day's exercises, in order. */
  exercises: readonly EditorExercise[];
  /** Stops Add exercise when the day holds all it can. */
  isFull: boolean;
  onChangeField: (key: number, field: ExerciseField, text: string) => void;
  onRemove: (key: number) => void;
  /** Opens the picker for this day. */
  onAdd: () => void;
};
