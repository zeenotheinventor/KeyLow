import { MUSCLE_IDS, MUSCLE_LIST_VERSION } from "./muscles";
import { SET_SNAPSHOT_VERSION } from "./versions";
import { setSnapshotSchema } from "../schemas/training";

import type { ExerciseMuscleEntry, ExerciseRow, SetSnapshot } from "../schemas/training";

export type SnapshotExercise = Pick<ExerciseRow, "id" | "name" | "equipment" | "mechanic">;

const listPosition = (muscle: ExerciseMuscleEntry): number => MUSCLE_IDS.indexOf(muscle.muscle_id);

/**
 * Freezes an exercise at the moment a set is logged: its id, name, equipment and mechanic, and its
 * muscle map against the current muscle list, so editing the exercise later never rewrites the set's
 * heat. The muscles are kept in the order of the muscle list, so the same map always gives the same
 * snapshot whatever order it was read in, and only their id, role and weight are carried.
 *
 * Throws a `RangeError` naming the rule when the map breaks one: no primary muscle, a muscle listed
 * twice, or a weight out of range.
 */
export const buildSetSnapshot = (
  exercise: SnapshotExercise,
  muscles: readonly ExerciseMuscleEntry[],
): SetSnapshot => {
  const snapshot = {
    version: SET_SNAPSHOT_VERSION,
    kind: "exercise",
    ref: exercise.id,
    name: exercise.name,
    equipment: exercise.equipment,
    mechanic: exercise.mechanic,
    muscleListVersion: MUSCLE_LIST_VERSION,
    muscles: [...muscles]
      .sort((first, second) => listPosition(first) - listPosition(second))
      .map(({ muscle_id, role, weight }) => ({ muscle_id, role, weight })),
  };
  const result = setSnapshotSchema.safeParse(snapshot);
  if (!result.success) {
    throw new RangeError(result.error.issues[0]?.message ?? "The set snapshot is not valid");
  }
  return result.data;
};
