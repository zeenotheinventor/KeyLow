import type { ExerciseSearchHit } from "@keylow/api-client";

/** The exercise a person picked: its id, name, equipment and the muscles its row drew. */
export type ChosenExercise = ExerciseSearchHit;

type AddExerciseDialogBaseProps = {
  open: boolean;
  /** The person closes the dialog, or has chosen an exercise and the dialog is done. The owner then sets `open` to false. */
  onClose: () => void;
  /**
   * Opens the New exercise form for the words searched for. The `Create "..."` row is drawn only when this is
   * given, so the row never leads nowhere.
   */
  onCreate?: ((name: string) => void) | undefined;
};

/**
 * `session` adds the exercise to the session in progress through `onAddToSession`, and the page draws a card
 * for it. `routine` hands the exercise back through `onChoose` and changes no session, because the routine
 * editor is not a session.
 */
export type AddExerciseDialogProps = AddExerciseDialogBaseProps &
  (
    | { mode: "session"; onAddToSession: (exercise: ChosenExercise) => void }
    | { mode: "routine"; onChoose: (exercise: ChosenExercise) => void }
  );
