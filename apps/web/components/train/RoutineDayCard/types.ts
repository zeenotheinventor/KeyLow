import type { DayMarks, EditorDay, ExerciseField } from "@keylow/core/training";

export type RoutineDayCardProps = {
  day: EditorDay;
  /** Where the day's problems are marked, or undefined while none is shown. */
  marks: DayMarks | undefined;
  exerciseCount: number;
  setCount: number;
  /** The day holds the most exercises, so Add exercise is dimmed. */
  isFull: boolean;
  onRename: (name: string) => void;
  /** A weekday from 0 (Monday) to 6 (Sunday), or null for any day. */
  onChangeWeekday: (weekday: number | null) => void;
  onRemove: () => void;
  onAddExercise: () => void;
  onChangeField: (exerciseKey: number, field: ExerciseField, text: string) => void;
  onRemoveExercise: (exerciseKey: number) => void;
};
