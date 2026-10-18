import { keys } from "./queryKeys";

import type { ExerciseDetail } from "./repos/exercises";
import type { QueryClient } from "@tanstack/react-query";

/** Puts a stored exercise in the cache of its own screen, so the screen that opens it next has it at once. */
export function putExerciseInCache(queryClient: QueryClient, exercise: ExerciseDetail): void {
  queryClient.setQueryData(keys.training.exercise(exercise.id), exercise);
}

/**
 * Marks every exercise search and the exercise `id` (when it is known) stale after a write. Nothing else
 * of training is touched: a logged set holds the muscle map it was logged with, so saving or archiving an
 * exercise changes no set, no session and no heat.
 */
export function refreshExercises(queryClient: QueryClient, id: string | undefined): void {
  void queryClient.invalidateQueries({ queryKey: keys.training.exerciseSearchAll });
  if (id !== undefined) {
    void queryClient.invalidateQueries({ queryKey: keys.training.exercise(id) });
  }
}

/**
 * Marks the active routine and every routine stale after an exercise is saved. No logged set changes, but
 * the plan shows the exercise's live name and muscle map (the routine reads embed them), so a saved edit
 * must reach it. The routine library, which holds set counts only, and every other training family are
 * left alone.
 */
export function refreshPlanExercises(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: keys.training.activeRoutine });
  void queryClient.invalidateQueries({ queryKey: keys.training.routineAll });
}
