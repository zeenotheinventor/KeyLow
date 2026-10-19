import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { reorderSets } from "../repos/setWrites";
import { SESSION_SET_SCOPE, refreshSessions } from "../sessionCache";

/** The session and its sets in the order they should have. */
export type ReorderSetsInput = { sessionId: string; orderedIds: readonly string[] };

/**
 * Puts live sets of a session in a new order (see `reorderSets`), which changes the order they are
 * read in and nothing else. Needs a connection: there is no offline queue. The updates are separate
 * requests, so a failure can leave some sets moved: the sessions, the heat, the week and the
 * "previous" values are refreshed after, also after a failure, and the screen shows what is stored.
 */
export function useReorderSets() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: "always",
    scope: SESSION_SET_SCOPE,
    mutationFn: ({ sessionId, orderedIds }: ReorderSetsInput) =>
      reorderSets(client, sessionId, orderedIds),
    onSettled: () => {
      refreshSessions(queryClient);
    },
  });
}
