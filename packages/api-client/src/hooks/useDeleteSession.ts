import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { clearActiveSessionInCache, refreshSessions } from "../sessionCache";
import { useSingleFlight } from "./useSingleFlight";
import { deleteSession } from "../repos/sessionWrites";

/**
 * Deletes a session and its sets with one call to the database, so the heat read no longer counts
 * them. There is no Undo: the screen says so before it asks. Needs a connection: there is no offline
 * queue. A session that does not exist or is not the caller's fails with the code P0002.
 *
 * The hook is not re-entrant: a second press for the same session while the first is pending joins it.
 * The session is cached as missing and cleared as the one in progress, and the session, heat and week
 * queries are refreshed after, also after a failure.
 */
export function useDeleteSession() {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const deleteOnce = useSingleFlight((id: string) => deleteSession(client, id));

  return useMutation({
    networkMode: "always",
    mutationFn: deleteOnce,
    onSuccess: (_, id) => {
      queryClient.setQueryData(keys.training.session(id), null);
      clearActiveSessionInCache(queryClient, id);
    },
    onSettled: () => {
      refreshSessions(queryClient);
    },
  });
}
