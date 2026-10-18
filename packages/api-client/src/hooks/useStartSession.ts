import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { putActiveSessionInCache, putSessionInCache, refreshSessions } from "../sessionCache";
import { useSingleFlight } from "./useSingleFlight";
import { startSession } from "../repos/sessionWrites";

import type { SessionStart } from "../repos/sessionWrites";

/**
 * Starts a session on a planned day (`routineDayId`) or free, at `now` in the profile's zone `tz`, and
 * resolves to it as stored (see `startSession`). If a session is already in progress, that one is the
 * result and nothing is inserted. Needs a connection: there is no offline queue, and a failure
 * throws for the screen's save-error state.
 *
 * The hook is not re-entrant: a second press with the same input while the first is pending joins it.
 * A press a moment later has a later `now`, so it runs after the first settles, finds the session it
 * started and resolves to it. The session is put in the cache as the one in progress and under its own
 * key, and the session, heat and week queries are refreshed after, also after a failure.
 */
export function useStartSession() {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const startOnce = useSingleFlight((start: SessionStart) => startSession(client, start));

  return useMutation({
    mutationFn: startOnce,
    onSuccess: (session) => {
      putSessionInCache(queryClient, session);
      putActiveSessionInCache(queryClient, session);
    },
    onSettled: () => {
      refreshSessions(queryClient);
    },
  });
}
