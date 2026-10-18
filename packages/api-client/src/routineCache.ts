import { keys } from "./queryKeys";

import type { RoutineDetail } from "./repos/routineSchemas";
import type { QueryClient } from "@tanstack/react-query";

/** Puts a stored routine in the cache of its own screen, so the screen that opens it next has it at once. */
export function putRoutineInCache(queryClient: QueryClient, routine: RoutineDetail): void {
  queryClient.setQueryData(keys.training.routine(routine.id), routine);
}

/** Marks the routine library and every routine stale after a write. Nothing of the plan is touched. */
export function refreshRoutines(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: keys.training.routinesAll });
  void queryClient.invalidateQueries({ queryKey: keys.training.routineAll });
}

/**
 * Marks every training family stale, for a write that changes the plan: heat, the week and the Train
 * home are worked out from the active routine, and the routines families sit under the same root.
 */
export function refreshTraining(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: keys.training.all });
}
