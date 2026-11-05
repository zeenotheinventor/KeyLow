import type { ExerciseSearchHit } from "@keylow/api-client";

/** The exercise a person picked: its id, name, equipment and the muscles its row drew. */
export type ChosenExercise = ExerciseSearchHit;

type AddExerciseSheetBaseProps = {
  open: boolean;
  /** The person closes the sheet, or has chosen an exercise and the sheet is done. The screen then sets `open` to false. */
  onClose: () => void;
};

/**
 * `session` adds the exercise to the session in progress through `onAddToSession`, and the screen draws a
 * card for it. `dayName` is the routine day the session follows, which the New exercise form names in its
 * Save button ("Save and add to Legs"), or null for a session that follows none. `routine` hands the
 * exercise back through `onChoose` and changes no session, because the routine editor is not a session.
 * In both, an exercise made in the New exercise form is handed on the same way as one that was picked.
 */
export type AddExerciseSheetProps = AddExerciseSheetBaseProps &
  (
    | {
        mode: "session";
        dayName: string | null;
        onAddToSession: (exercise: ChosenExercise) => void;
      }
    | { mode: "routine"; onChoose: (exercise: ChosenExercise) => void }
  );
