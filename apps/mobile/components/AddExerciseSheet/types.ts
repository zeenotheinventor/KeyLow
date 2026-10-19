import type { ExerciseSearchHit } from "@keylow/api-client";

/** The exercise a person picked: its id, name, equipment and the muscles its row drew. */
export type ChosenExercise = ExerciseSearchHit;

type AddExerciseSheetBaseProps = {
  open: boolean;
  /** The person closes the sheet, or has chosen an exercise and the sheet is done. The screen then sets `open` to false. */
  onClose: () => void;
  /**
   * Opens the New exercise form for the words searched for. The `Create "…"` row is drawn only when this is
   * given, so the row never leads nowhere.
   */
  onCreate?: ((name: string) => void) | undefined;
};

/**
 * `session` adds the exercise to the session in progress through `onAddToSession`, and the screen draws a
 * card for it. `routine` hands the exercise back through `onChoose` and changes no session, because the
 * routine editor is not a session.
 */
export type AddExerciseSheetProps = AddExerciseSheetBaseProps &
  (
    | { mode: "session"; onAddToSession: (exercise: ChosenExercise) => void }
    | { mode: "routine"; onChoose: (exercise: ChosenExercise) => void }
  );
