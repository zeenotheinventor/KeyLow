import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { restoreSet } from "../repos/setWrites";
import { SESSION_SET_SCOPE, putSetInSessionCaches, refreshSessions } from "../sessionCache";

/**
 * Brings a removed set back (the Undo of `useRemoveSet`) and resolves to it as stored. A session that
 * already holds 200 live sets refuses with a `RangeError` stating the rule. Needs a connection: there
 * is no offline queue. It shares a scope with the other set edits, so an Undo tapped while the remove
 * is on its way waits for it.
 *
 * The set goes back into the cached session and the session in progress, in its place. The sessions,
 * the heat, the week and the "previous" values are refreshed after, also after a failure.
 */
export function useRestoreSet() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    scope: SESSION_SET_SCOPE,
    mutationFn: (id: string) => restoreSet(client, id),
    onSuccess: (set) => {
      putSetInSessionCaches(queryClient, set);
    },
    onSettled: () => {
      refreshSessions(queryClient);
    },
  });
}
