import type { ChosenExercise } from "../types";

export type AddExercisePickerProps = {
  onChoose: (exercise: ChosenExercise) => void;
  onCreate?: ((name: string) => void) | undefined;
};
