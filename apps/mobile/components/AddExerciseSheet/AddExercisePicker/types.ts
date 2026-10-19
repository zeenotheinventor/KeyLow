import type { ChosenExercise } from "../types";

export type AddExercisePickerProps = {
  onChoose: (exercise: ChosenExercise) => void;
  onClose: () => void;
  onCreate?: ((name: string) => void) | undefined;
};
