import type { ExerciseMuscleEntry } from "@keylow/core/schemas";

/** The exercise the sheet shows. */
export type ExerciseMusclesSheetExercise = {
  id: string;
  name: string;
  /** The exercise's muscle map when the phone already holds it, or null when the sheet has to read it. */
  muscles: readonly ExerciseMuscleEntry[] | null;
};

export type ExerciseMusclesSheetProps = {
  /** The exercise whose muscles are shown, or null for a closed sheet. */
  exercise: ExerciseMusclesSheetExercise | null;
  onClose: () => void;
};
