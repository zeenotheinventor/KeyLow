import type { SessionSet } from "@keylow/api-client";
import type { LoadUnit, SessionExercise } from "@keylow/core/training";

export type SessionExerciseCardProps = {
  /** The id of the session in progress, which its own sets are left out of the Previous read. */
  sessionId: string;
  name: string;
  /** The line under the name: "3 × 10 to 12 · RIR 1 · Machine". */
  target: string;
  unit: LoadUnit;
  /** The exercise's rows: `sessionExercises`' entry for it. */
  exercise: SessionExercise<SessionSet>;
  /** Every set of the session, which the next row's numbers are opened from. */
  sessionSets: readonly SessionSet[];
};
