import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { updateSet } from "../repos/setWrites";
import { SESSION_SET_SCOPE, putSetInSessionCaches, refreshSessions } from "../sessionCache";

import type { SetPatch } from "../repos/setWrites";

/** The set to change and what to change on it (see `SetPatch`). */
export type UpdateSetInput = { id: string; patch: SetPatch };

/**
 * Changes a live set and resolves to it as stored (see `updateSet`): its position, type, reps, load or
 * effort. It never changes the snapshot, the session or the exercise. Needs a connection: there is no
 * offline queue. Edits run one after another in the order they were made, and the last wins.
 *
 * The stored set replaces the one in the cached session and the session in progress. The sessions, the
 * heat, the week and the "previous" values are refreshed after, also after a failure, so a set edited
 * from the history updates that day's heat and the week's sets.
 */
export function useUpdateSet() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    scope: SESSION_SET_SCOPE,
    mutationFn: ({ id, patch }: UpdateSetInput) => updateSet(client, id, patch),
    onSuccess: (set) => {
      putSetInSessionCaches(queryClient, set);
    },
    onSettled: () => {
      refreshSessions(queryClient);
    },
  });
}
