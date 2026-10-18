import { isMuscleId, MUSCLE_LIST_VERSION } from "./muscles";
import { SET_SNAPSHOT_VERSION } from "./versions";
import { setSnapshotSchema } from "../schemas/training";

import type { SetSnapshot } from "../schemas/training";

/**
 * Why a stored value is not a set snapshot this build can read. `unknown_version` is a snapshot or muscle
 * list version newer (or older) than the ones it knows, `unknown_muscle` a muscle id that is not on the
 * list, and `invalid` anything else.
 */
export type SetSnapshotProblem = "unknown_version" | "unknown_muscle" | "invalid";

export type ParsedSetSnapshot =
  { ok: true; snapshot: SetSnapshot } | { ok: false; problem: SetSnapshotProblem };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasUnknownVersion = (value: Record<string, unknown>): boolean =>
  ("version" in value && value.version !== SET_SNAPSHOT_VERSION) ||
  ("muscleListVersion" in value && value.muscleListVersion !== MUSCLE_LIST_VERSION);

const hasUnknownMuscle = (value: Record<string, unknown>): boolean =>
  Array.isArray(value.muscles) &&
  value.muscles.some(
    (muscle: unknown) => isRecord(muscle) && "muscle_id" in muscle && !isMuscleId(muscle.muscle_id),
  );

/**
 * Reads a stored `workout_sets.snapshot`. A version this build does not know is reported before
 * anything else, because its shape may differ for good reason, then a muscle id that is not on the
 * list, then any other break of the shape. It never throws.
 */
export const parseSetSnapshot = (value: unknown): ParsedSetSnapshot => {
  if (!isRecord(value)) {
    return { ok: false, problem: "invalid" };
  }
  if (hasUnknownVersion(value)) {
    return { ok: false, problem: "unknown_version" };
  }
  if (hasUnknownMuscle(value)) {
    return { ok: false, problem: "unknown_muscle" };
  }
  const result = setSnapshotSchema.safeParse(value);
  return result.success ? { ok: true, snapshot: result.data } : { ok: false, problem: "invalid" };
};
