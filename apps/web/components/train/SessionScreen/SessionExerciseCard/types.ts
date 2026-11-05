import type { ExercisePlan, ScreenSet, SetLogging, useChangeSetType } from "@keylow/api-client";
import type { LoadUnit, SessionExercise, SetType } from "@keylow/core/training";

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
  /** Changes the type of a logged set, and says which sets are being changed. */
  typeChange: ReturnType<typeof useChangeSetType>;
};

/**
 * The text typed into the fields of the rows still to log, and the type chosen for the row, by row, kept
 * until the set is logged.
 */
export type RowEdits = Readonly<
  Record<string, Readonly<{ load?: string; reps?: string; rir?: string; setType?: SetType }>>
>;

/** The set the set types dialog is open for: its row, who it is and the mark that opened it. */
export type SetTypeOpening = {
  rowKey: string;
  /** The stored set, or null for a row still to log, whose type is kept with what is typed in it. */
  setId: string | null;
  setType: SetType;
  /** The number the set has among the working sets, or would have as one. */
  setNumber: number;
  mark: HTMLButtonElement;
};
