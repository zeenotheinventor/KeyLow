import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSingleFlight } from "./useSingleFlight";
import { refreshExercises } from "../exerciseCache";
import { useSupabase } from "../KeyLowProvider";
import { archiveExercise } from "../repos/exerciseWrites";

/**
 * Archives a custom exercise by its id: it no longer shows in search or on its screen, and the sets
 * already logged and the routines that name it keep referencing it. An exercise of the library throws an
 * `ExerciseRuleError` with the rule `global_exercise`. Needs a connection: there is no offline queue.
 *
 * The hook is not re-entrant: a second press with the same id while the first is pending joins it.
 *
 * The exercise searches and the exercise are refreshed after, also after a failure, and nothing else:
 * a logged set holds the muscle map it was logged with.
 */
export function useArchiveExercise() {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const archiveOnce = useSingleFlight((id: string) => archiveExercise(client, id));

  return useMutation({
    networkMode: "always",
    mutationFn: archiveOnce,
    onSettled: (_result, _error, id) => {
      refreshExercises(queryClient, id);
    },
  });
}
