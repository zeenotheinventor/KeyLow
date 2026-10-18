import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSingleFlight } from "./useSingleFlight";
import { putExerciseInCache, refreshExercises, refreshPlanExercises } from "../exerciseCache";
import { useSupabase } from "../KeyLowProvider";
import { saveExercise } from "../repos/exerciseWrites";

import type { ExerciseSave } from "../repos/exerciseWrites";

/**
 * Creates a custom exercise (no `id`) or replaces the name, equipment and muscle map of one (`id`), and
 * resolves to it as stored. It is one call to the database, so all of it is written or none of it. A
 * draft the database would refuse throws a `RangeError` before any request, naming each field and rule,
 * and an exercise of the library throws an `ExerciseRuleError` with the rule `global_exercise`. Needs a
 * connection: there is no offline queue.
 *
 * The hook is not re-entrant: a second press of Save with the same input while the first is pending
 * joins it and resolves to the same exercise. A different input is a different edit and runs after the
 * pending save settles, so the last save wins.
 *
 * The stored exercise replaces the cached one, and the exercise searches and the exercise are refreshed
 * after, also after a failure. So are the active routine and the routines (`activeRoutine` and
 * `routineAll`): no logged set changes, since a set holds the muscle map it was logged with, but the plan
 * shows the exercise's live name and muscle map. Nothing else is, so no set, session or heat is
 * refreshed. Archiving does not refresh the plan, since a routine keeps naming an archived exercise.
 */
export function useSaveExercise() {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const saveOnce = useSingleFlight((save: ExerciseSave) => saveExercise(client, save));

  return useMutation({
    mutationFn: saveOnce,
    onSuccess: (exercise) => {
      putExerciseInCache(queryClient, exercise);
    },
    onSettled: (exercise, _error, save) => {
      refreshExercises(queryClient, exercise?.id ?? save.id);
      refreshPlanExercises(queryClient);
    },
  });
}
