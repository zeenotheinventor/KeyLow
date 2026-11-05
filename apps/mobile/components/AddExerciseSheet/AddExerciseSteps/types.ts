import type { ChosenExercise } from "../types";
import type { SaveCustomExerciseDestination } from "@keylow/core/copy";

export type AddExerciseStepsProps = {
  /** Where an exercise made in the form goes, which words the form's Save button. */
  destination: SaveCustomExerciseDestination;
  onChoose: (exercise: ChosenExercise) => void;
  onClose: () => void;
};
