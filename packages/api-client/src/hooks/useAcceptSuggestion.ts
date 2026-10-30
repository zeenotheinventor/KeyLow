import { useMutation, useQueryClient } from "@tanstack/react-query";

import { suggestionEquipmentKey } from "./suggestionEquipmentKey";
import { useSingleFlight } from "./useSingleFlight";
import {
  afterEarlierAcceptedSuggestionWrites,
  refreshAcceptedSuggestions,
} from "../acceptedSuggestionWrites";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { acceptSuggestion } from "../repos/acceptedSuggestions";
import { listSuggestionLibrary } from "../repos/suggestionLibrary";
import { getCurrentTrainingGoals } from "../repos/trainingGoals";

import type { Suggestion } from "@keylow/core/training";

export type AcceptSuggestionInput = {
  /** The suggestion on screen. Only the exercises it added are stored. */
  suggestion: Suggestion;
  /** The day it is accepted into, `YYYY-MM-DD` in the user's zone. */
  localDate: string;
  /** The routine day it is folded into, or null when it stands alone. */
  routineDayId: string | null;
};

/**
 * Accepts the suggestion into a day, so it counts as planned in the projection, and resolves to the row as
 * stored (its id is the Undo's, see `useUndoAcceptedSuggestion`). The day keeps one accepted suggestion:
 * accepting again replaces it (see `acceptSuggestion`). The muscle maps frozen with the added exercises come
 * from the library the suggestion was made from, read here from the cache or the database as
 * `useSuggestion` reads it, so the caller passes the suggestion alone. Needs a connection: there is no
 * offline queue, nothing is replayed from storage, and a failure throws for the screen's error state with
 * the action and the code only. A suggestion with nothing to add throws a `RangeError` before any write.
 *
 * The hook is not re-entrant: a second press with the same suggestion, day and routine day while the first
 * is pending joins it. Writes of the accepted suggestions run one after another, across this hook and
 * `useUndoAcceptedSuggestion`, so an Undo tapped while an accept is on its way waits for it. The accepted
 * suggestions, the week and the heat are marked stale after, also after a failure, so the projection is worked
 * out again from the rows as they are.
 */
export function useAcceptSuggestion() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  const library = async () => {
    // The goal and the library a suggestion is made from sit in the cache for as long as the screen is
    // up, so the cached rows are used, and are read only when the cache was cleared meanwhile.
    const goal = await queryClient.query({
      queryKey: keys.training.goals,
      queryFn: () => getCurrentTrainingGoals(client),
      staleTime: Infinity,
    });
    if (goal === null) {
      throw new RangeError("A suggestion cannot be accepted without a training goal");
    }
    return queryClient.query({
      queryKey: keys.training.suggestionLibrary(suggestionEquipmentKey(goal.equipment)),
      queryFn: () => listSuggestionLibrary(client, { equipment: goal.equipment }),
      staleTime: Infinity,
    });
  };

  const acceptOnce = useSingleFlight((input: AcceptSuggestionInput) =>
    afterEarlierAcceptedSuggestionWrites(queryClient, async () =>
      acceptSuggestion(client, { ...input, library: await library() }),
    ),
  );

  return useMutation({
    networkMode: "always",
    mutationFn: acceptOnce,
    onSettled: () => {
      refreshAcceptedSuggestions(queryClient);
    },
  });
}
