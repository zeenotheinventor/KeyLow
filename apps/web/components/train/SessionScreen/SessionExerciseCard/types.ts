import type { ExercisePlan, ScreenSet, SetLogging } from "@keylow/api-client";
import type { LoadUnit, SessionExercise } from "@keylow/core/training";

export type SessionExerciseCardProps = {
  sessionId: string;
  name: string;
  /** The line under the name: "3 × 10 to 12 · RIR 1 · Machine". */
  target: string;
  /** The plan's sets, rep range and RIR for the exercise, or null for one added to the session. */
  plan: ExercisePlan | null;
  unit: LoadUnit;
  exercise: SessionExercise<ScreenSet>;
  /** Every set of the session, which the next set's numbers are filled from. */
  sessionSets: readonly ScreenSet[];
  logging: SetLogging;
};

/** The text typed into the fields of the rows still to log, by row, kept until the set is logged. */
export type RowEdits = Readonly<
  Record<string, Readonly<Partial<Record<"load" | "reps" | "rir", string>>>>
>;
