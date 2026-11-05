import type { ExerciseMuscleEntry } from "@keylow/core/schemas";

export type ExerciseMusclesDialogProps = {
  exerciseId: string;
  exerciseName: string;
  /** The exercise's muscle map when the page already holds it, or null when the dialog has to read it. */
  muscles: readonly ExerciseMuscleEntry[] | null;
  /** Called for Escape, Close and a press on the dimmed page. */
  onClose: () => void;
  /** The button that opened the dialog, which takes focus back when it closes. */
  returnFocusTo: Element | null;
};
