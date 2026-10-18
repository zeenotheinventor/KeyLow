import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { saveRoutine } from "../repos/routineWrites";
import { putRoutineInCache, refreshRoutines, refreshTraining } from "../routineCache";
import { useSingleFlight } from "./useSingleFlight";

import type { RoutineSave } from "../repos/routineWrites";

/**
 * Creates a routine (`id` null) or replaces the name, days and exercises of one (`id`), and resolves
 * to it as stored. It is one call to the database, so all of it is written or none of it, and a day
 * sent with its id keeps it. A draft the database would refuse throws a `RangeError` before any
 * request, naming each rule and where it failed. Needs a connection: there is no offline queue.
 *
 * The hook is not re-entrant: a second press of Save with the same input while the first is pending
 * joins it and resolves to the same routine. A different input is a different edit and runs after the
 * pending save settles, so the last save wins.
 *
 * The stored routine replaces the cached one, and the routines queries are refreshed after, also after
 * a failure. When the saved routine is the active one the plan changed, so every training query is
 * refreshed too: heat, the week and the Train home are recomputed.
 */
export function useSaveRoutine() {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const saveOnce = useSingleFlight((save: RoutineSave) => saveRoutine(client, save));

  return useMutation({
    mutationFn: saveOnce,
    onSuccess: (routine) => {
      putRoutineInCache(queryClient, routine);
      if (routine.is_active) {
        refreshTraining(queryClient);
      }
    },
    onSettled: () => {
      refreshRoutines(queryClient);
    },
  });
}
