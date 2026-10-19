import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { clearActiveSessionInCache, putSessionInCache, refreshSessions } from "../sessionCache";
import { useSingleFlight } from "./useSingleFlight";
import { finishSession } from "../repos/sessionWrites";

import type { SessionFinish } from "../repos/sessionWrites";

/** The session to finish, with the end and the note (see `SessionFinish`). */
export type FinishSessionInput = SessionFinish & { id: string };

/**
 * Ends a session at `endedAt` with a note and resolves to it as stored (see `finishSession`). The end
 * is set once, so finishing a finished session resolves to it unchanged. A note over 1,000 characters
 * or an end before the start throws a `RangeError` naming the rule. Needs a connection: there is no
 * offline queue.
 *
 * The hook is not re-entrant: a second press with the same input while the first is pending joins it.
 * The stored session is put in the cache under its own key and is cleared as the one in progress, and
 * the session, heat and week queries are refreshed after, also after a failure.
 */
export function useFinishSession() {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const finishOnce = useSingleFlight(({ id, ...finish }: FinishSessionInput) =>
    finishSession(client, id, finish),
  );

  return useMutation({
    networkMode: "always",
    mutationFn: finishOnce,
    onSuccess: (session) => {
      putSessionInCache(queryClient, session);
      clearActiveSessionInCache(queryClient, session.id);
    },
    onSettled: () => {
      refreshSessions(queryClient);
    },
  });
}
