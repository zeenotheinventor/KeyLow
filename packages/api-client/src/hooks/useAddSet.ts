import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { putSetInSessionCaches, refreshSessions } from "../sessionCache";
import { useSingleFlight } from "./useSingleFlight";
import { addSet } from "../repos/setWrites";

import type { SetAdd } from "../repos/setWrites";

/**
 * Logs a set and resolves to it as stored (see `addSet`). Needs a connection: there is no offline
 * queue, and a failure throws for the screen's save-error state, which keeps what the user typed.
 *
 * The hook is not re-entrant: a second press of Log set with the same session, exercise, draft, unit
 * and effort setting while the first is pending joins it, whatever time it carries, so a double press
 * logs one set. A press with another draft runs after the first settles, one place further on. The
 * stored set is put in the cached session and the session in progress, and the sessions, the heat, the
 * week and the "previous" values are refreshed after, also after a failure.
 */
export function useAddSet() {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const logOnce = useSingleFlight(
    (input: SetAdd) => addSet(client, input),
    ({ sessionId, exerciseId, draft, unit, effortMode }) =>
      JSON.stringify({ sessionId, exerciseId, draft, unit, effortMode }),
  );

  return useMutation({
    networkMode: "always",
    mutationFn: logOnce,
    onSuccess: (set) => {
      putSetInSessionCaches(queryClient, set);
    },
    onSettled: () => {
      refreshSessions(queryClient);
    },
  });
}
