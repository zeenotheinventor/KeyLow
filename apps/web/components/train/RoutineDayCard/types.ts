import type {
  DayMarks,
  EditorDay,
  EditorExercise,
  ExerciseField,
  MoveDirection,
} from "@keylow/core/training";

export type RoutineDayCardProps = {
  day: EditorDay;
  /** Where the day's problems are marked, or undefined while none is shown. */
  marks: DayMarks | undefined;
  exerciseCount: number;
  setCount: number;
  /** The day holds the most exercises, so Add exercise is dimmed. */
  isFull: boolean;
  /** The day is the first, so Move up is dimmed. */
  isFirst: boolean;
  /** The day is the last, so Move down is dimmed. */
  isLast: boolean;
  onRename: (name: string) => void;
  /** A weekday from 0 (Monday) to 6 (Sunday), or null for any day. */
  onChangeWeekday: (weekday: number | null) => void;
  onMove: (direction: MoveDirection) => void;
  onRemove: () => void;
  onAddExercise: () => void;
  onChangeField: (exerciseKey: number, field: ExerciseField, text: string) => void;
  onMoveExercise: (exercise: EditorExercise, position: number, direction: MoveDirection) => void;
  onRemoveExercise: (exerciseKey: number) => void;
};
