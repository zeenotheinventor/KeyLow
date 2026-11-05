import type { ChosenExercise } from "../types";
import type { SaveCustomExerciseDestination } from "@keylow/core/copy";
import type { MuscleId, MuscleRole } from "@keylow/core/training";

export type CustomExerciseFormProps = {
  /** Where the exercise goes once saved, which words the Save button: "Save and add to Legs" or "Save and add". */
  destination: SaveCustomExerciseDestination;
  /** The name the form starts with, such as the words the person searched for. */
  initialName: string;
  /** Returns to the search. */
  onBack: () => void;
  /** The exercise as stored, once it is saved. The sheet then hands it on and closes. */
  onSaved: (exercise: ChosenExercise) => void;
};

/** A muscle of the draft with the role the person chose for it. */
export type DraftMuscle = { muscle_id: MuscleId; role: MuscleRole };
