import { curl, curlMuscles } from "./plans";
import { buildSetSnapshot } from "../../src/training";

import type { ExerciseMuscleEntry } from "../../src/schemas";
import type { AcceptedExercise, AcceptedSuggestion, SnapshotExercise } from "../../src/training";

/** An exercise of an accepted suggestion, with the snapshot frozen from its muscle map. */
export const acceptedExercise = (
  exercise: SnapshotExercise,
  muscles: readonly ExerciseMuscleEntry[],
  targetSets: number,
  targetRir: number | null,
  position: number,
): AcceptedExercise => ({
  id: exercise.id,
  position,
  exercise_id: exercise.id,
  target_sets: targetSets,
  target_rir: targetRir,
  exercise,
  muscles,
  snapshot: buildSetSnapshot(exercise, muscles),
});

/** An accepted suggestion of 3 sets of dumbbell curl on `localDate`, folded into `routineDayId` or standing alone. */
export const curlSuggestion = (
  localDate: string,
  routineDayId: string | null,
): AcceptedSuggestion => ({
  local_date: localDate,
  routine_day_id: routineDayId,
  exercises: [acceptedExercise(curl, curlMuscles, 3, 2, 0)],
});
