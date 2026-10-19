import { z } from "zod";

import { FULL_SESSION_RULE, MAX_SETS_PER_SESSION } from "./bounds";
import { buildSetSnapshot } from "./buildSetSnapshot";
import { loadToKg } from "./loads";
import { setValueIssues } from "./setInput";

import type { SnapshotExercise } from "./buildSetSnapshot";
import type { SetType } from "./enums";
import type { SetValues } from "./setInput";
import type { ExerciseMuscleEntry, SetSnapshot } from "../schemas/training";

/** The columns of `workout_sets` that `authenticated` may insert. `user_id` is left to its default. */
export type WorkoutSetInsert = Readonly<{
  session_id: string;
  exercise_id: string;
  position: number;
  set_type: SetType;
  reps: number;
  load_kg: number | null;
  rir: number | null;
  rpe: number | null;
  performed_at: string;
  snapshot: SetSnapshot;
}>;

export type WorkoutSetInsertInput = Readonly<{
  sessionId: string;
  exercise: SnapshotExercise;
  muscles: readonly ExerciseMuscleEntry[];
  /** The cleaned numbers of the set, as `validateSetDraft` returns them. */
  draft: SetValues;
  position: number;
  /** An ISO 8601 timestamp that states its zone. */
  performedAt: string;
  /** Sets of the session not soft deleted, before this one. */
  liveSetsInSession: number;
}>;

/** Whether a write was refused because the session already holds its most live sets, which a screen words for itself. */
export const isFullSessionRefusal = (error: unknown): boolean =>
  error instanceof RangeError && error.message === FULL_SESSION_RULE;

// The schemas' timestamp rule: a zone designator is required, so a time never depends on the device zone.
const timestampSchema = z.iso.datetime({ offset: true });

/**
 * The row to insert for one logged set. The load is rounded to the gram, and the snapshot freezes the
 * exercise and its muscle map at this moment (`buildSetSnapshot`).
 *
 * Throws a `RangeError` stating the rule, and never a value, because a set is health data and must
 * not reach a log: when the session already holds 200 live sets, when `performedAt` has no zone, when
 * the numbers break a set rule (the message lists the rule codes), or when the muscle map is not valid.
 */
export const buildWorkoutSetInsert = (input: WorkoutSetInsertInput): WorkoutSetInsert => {
  const { sessionId, exercise, muscles, draft, position, performedAt, liveSetsInSession } = input;

  if (liveSetsInSession >= MAX_SETS_PER_SESSION) {
    throw new RangeError(FULL_SESSION_RULE);
  }
  if (!timestampSchema.safeParse(performedAt).success) {
    throw new RangeError("A set's performed_at must be an ISO timestamp with a zone.");
  }

  const loadKg = draft.loadKg === null ? null : loadToKg(draft.loadKg, "kg");
  const issues = setValueIssues({ ...draft, loadKg });
  if (issues.length > 0) {
    throw new RangeError(`The set breaks the rules: ${issues.map(({ rule }) => rule).join(", ")}.`);
  }

  return {
    session_id: sessionId,
    exercise_id: exercise.id,
    position,
    set_type: draft.setType,
    reps: draft.reps,
    load_kg: loadKg,
    rir: draft.rir,
    rpe: draft.rpe,
    performed_at: performedAt,
    snapshot: buildSetSnapshot(exercise, muscles),
  };
};
