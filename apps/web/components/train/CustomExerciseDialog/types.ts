import type { ChosenExercise } from "../AddExerciseDialog";
import type { SaveCustomExerciseDestination } from "@keylow/core/copy";
import type { MuscleId, MuscleRole } from "@keylow/core/training";

export type CustomExerciseDialogProps = {
  /** Where the exercise goes once saved, which words the Save button: "Save and add to Legs" or "Save and add". */
  destination: SaveCustomExerciseDestination;
  /** The name the form starts with, such as the words the person searched for. */
  initialName: string;
  /** Steps back to the search, from Escape, Close and a press on the dimmed page. The owner unmounts the dialog, which drops the draft. */
  onClose: () => void;
  /** The exercise as stored, once it is saved. The owner then adds it and closes the search too. */
  onSaved: (exercise: ChosenExercise) => void;
};

/** A muscle of the draft with the role the person chose for it. */
export type DraftMuscle = { muscle_id: MuscleId; role: MuscleRole };
