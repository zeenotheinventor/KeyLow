import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { removeSet } from "../repos/setWrites";
import { SESSION_SET_SCOPE, putSetInSessionCaches, refreshSessions } from "../sessionCache";

/**
 * Removes a set (a soft delete) and resolves to it as stored, for the Undo toast "Set removed. Undo",
 * which is `useRestoreSet` with the same id. Needs a connection: there is no offline queue. It shares
 * a scope with the other set edits, so an Undo tapped while the remove is on its way waits for it.
 * Removing a set that is already removed changes nothing.
 *
 * The set comes out of the cached session and the session in progress. The sessions, the heat, the
 * week and the "previous" values are refreshed after, also after a failure, so a removed set stops
 * counting.
 */
export function useRemoveSet() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: "always",
    scope: SESSION_SET_SCOPE,
    mutationFn: (id: string) => removeSet(client, id),
    onSuccess: (set) => {
      putSetInSessionCaches(queryClient, set);
    },
    onSettled: () => {
      refreshSessions(queryClient);
    },
  });
}
