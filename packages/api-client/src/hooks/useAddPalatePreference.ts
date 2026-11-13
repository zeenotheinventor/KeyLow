import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { useSingleFlight } from "./useSingleFlight";
import { addPalatePreference } from "../repos/palatePreferences";

import type { PalateStatement } from "../repos/palatePreferences";

// The same press is the same word under the same kind, whatever its case or the spaces around it.
const pressOf = ({ kind, label }: PalateStatement) => `${kind}:${label.trim().toLowerCase()}`;

/**
 * Adds a stated dislike or allergy and resolves to the row as stored. Adding the same word twice under
 * one kind fails, and `isDuplicatePalatePreference` tells that failure apart. The hook is not
 * re-entrant: a second press of the same word while the first is pending joins it, so a double press
 * sends one request. Needs a connection: there is no offline queue, so it fails at once without one.
 * The palate queries are refreshed once the call is settled, also after a failure. A palate is health
 * data, so an error names the action and the code only.
 */
export function useAddPalatePreference() {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const addOnce = useSingleFlight(
    (statement: PalateStatement) => addPalatePreference(client, statement),
    pressOf,
  );

  return useMutation({
    networkMode: "always",
    mutationFn: addOnce,
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.palate.all }),
  });
}
