import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSingleFlight } from "./useSingleFlight";
import {
  afterEarlierAcceptedSuggestionWrites,
  refreshAcceptedSuggestions,
} from "../acceptedSuggestionWrites";
import { useSupabase } from "../KeyLowProvider";
import { undoAcceptedSuggestion } from "../repos/acceptedSuggestions";

/**
 * Undoes an accept (the Undo of the toast "Added to Thursday: 3 sets of incline dumbbell press") with the
 * id `useAcceptSuggestion` resolved to, so the suggestion stops counting as planned. It is a soft delete,
 * and undoing a row that is already undone changes nothing. Needs a connection: there is no offline queue,
 * and a failure throws with the action and the code only.
 *
 * The hook is not re-entrant: a second press with the same id while the first is pending joins it. Writes
 * of the accepted suggestions run one after another, across this hook and `useAcceptSuggestion`, so an Undo
 * tapped while an accept is on its way waits for it. The accepted suggestions, the week and the heat are
 * marked stale after, also after a failure.
 */
export function useUndoAcceptedSuggestion() {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const undoOnce = useSingleFlight((id: string) =>
    afterEarlierAcceptedSuggestionWrites(queryClient, () => undoAcceptedSuggestion(client, id)),
  );

  return useMutation({
    networkMode: "always",
    mutationFn: undoOnce,
    onSettled: () => {
      refreshAcceptedSuggestions(queryClient);
    },
  });
}
