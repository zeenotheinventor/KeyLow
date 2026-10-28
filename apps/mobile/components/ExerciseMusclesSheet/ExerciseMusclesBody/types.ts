import type { ExerciseMusclesSheetExercise } from "../types";

export type ExerciseMusclesBodyProps = {
  exercise: ExerciseMusclesSheetExercise;
  /** Whether the sheet is open. The muscles are read only while it is, and the last state stays on show once it is not. */
  isOpen: boolean;
};
