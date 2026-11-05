import type { ChosenExercise } from "../types";

export type AddExercisePickerProps = {
  /** The words the search starts with, such as those a person came back with from the New exercise form. */
  initialQuery: string;
  onChoose: (exercise: ChosenExercise) => void;
  onClose: () => void;
  /** Opens the New exercise form for the words searched for. */
  onCreate: (name: string) => void;
};
