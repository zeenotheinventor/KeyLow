import { skipToken, useQuery } from "@tanstack/react-query";

import { suggestionEquipmentKey } from "./suggestionEquipmentKey";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listSuggestionLibrary } from "../repos/suggestionLibrary";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { Equipment } from "@keylow/core/training";

const ONE_DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

// The library changes only on an import or when the user saves or archives a custom exercise, which
// refreshes it, so it is held for the session and read again on the next day at the earliest.
const LIBRARY_LIFETIME = ONE_DAY_IN_MILLISECONDS;

/**
 * Loads the live exercises `suggestSession` chooses from, each with its muscle map: the library and the
 * signed in user's own, of the equipment given. Key `keys.training.suggestionLibrary(equipmentKey)`. It is
 * global reference data and big, and acting on a suggestion needs a connection, so it is never in the
 * persisted offline cache: it is kept for the session only, and a restored app reads it again with a
 * connection. With no equipment given (the goal is not known yet) nothing is read. `enabled` false makes
 * no request at all.
 */
export function useSuggestionLibrary(
  equipment: readonly Equipment[] | undefined,
  { enabled = true }: DiaryReadOptions = {},
) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.training.suggestionLibrary(
      equipment === undefined ? "" : suggestionEquipmentKey(equipment),
    ),
    queryFn:
      equipment === undefined ? skipToken : () => listSuggestionLibrary(client, { equipment }),
    enabled,
    staleTime: LIBRARY_LIFETIME,
    gcTime: LIBRARY_LIFETIME,
  });
}
