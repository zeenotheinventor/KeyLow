import type { ScreenSet, SetLogging, SetTypeOpening } from "../SessionScreen";
import type { ExercisePlan, SetEntryOpening } from "../SetEntrySheet";
import type { LoadUnit, SessionExercise } from "@keylow/core/training";

export type SessionExerciseCardProps = {
  /** The id of the session in progress, which its own sets are left out of the Previous read. */
  sessionId: string;
  name: string;
  /** The line under the name: "3 × 10 to 12 · RIR 1 · Machine". */
  target: string;
  /** The plan's sets, rep range and RIR for the exercise, or null for one added to the session. */
  plan: ExercisePlan | null;
  unit: LoadUnit;
  /** The exercise's rows: `sessionExercises`' entry for it. */
  exercise: SessionExercise<ScreenSet>;
  /** Every set of the session, which the next row's numbers are opened from. */
  sessionSets: readonly ScreenSet[];
  /** Whether a change of the set's type is on its way, which leaves its mark inert until the write lands. */
  isChangingType: (setId: string) => boolean;
  /** What the checks do. */
  logging: SetLogging;
  /** Asked for when the cells of a set still to do are pressed, or the check of a row with no numbers to log, with what the set entry opens with. */
  onEditSet: (entry: SetEntryOpening) => void;
  /** Asked for when the mark of a logged set is pressed, with the set the set types sheet opens for. */
  onEditSetType: (opening: SetTypeOpening) => void;
  /** Asked for when the body icon button or the name is pressed, which opens the muscles the exercise works. */
  onShowMuscles: () => void;
};
