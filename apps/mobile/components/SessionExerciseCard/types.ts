import type { ExercisePlan, SetEntryOpening } from "../SetEntrySheet";
import type { SessionSet } from "@keylow/api-client";
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
  exercise: SessionExercise<SessionSet>;
  /** Every set of the session, which the next row's numbers are opened from. */
  sessionSets: readonly SessionSet[];
  /** Asked for when the cells of a set still to do are pressed, with what the set entry opens with. */
  onEditSet: (entry: SetEntryOpening) => void;
};
