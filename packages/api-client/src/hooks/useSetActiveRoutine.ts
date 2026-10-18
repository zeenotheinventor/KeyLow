import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { setActiveRoutine } from "../repos/routineWrites";
import { refreshTraining } from "../routineCache";
import { useSingleFlight } from "./useSingleFlight";

/**
 * Makes a routine the active one, which clears whichever was active, and resolves to it as stored with
 * the moment it was activated (a routine plans from that day). With null it clears the active routine
 * and resolves to null. At most one routine is active. Needs a connection: there is no offline queue.
 *
 * The hook is not re-entrant: a second press with the same routine while the first is pending joins it.
 * Every training query is refreshed after, also after a failure, since the plan changed: heat, the week
 * and the Train home are recomputed, and so are the routines.
 */
export function useSetActiveRoutine() {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const activateOnce = useSingleFlight((id: string | null) => setActiveRoutine(client, id));

  return useMutation({
    mutationFn: activateOnce,
    onSettled: () => {
      refreshTraining(queryClient);
    },
  });
}
