import { useQuery } from "@tanstack/react-query";

import { retryUnlessRangeError } from "./retryUnlessRangeError";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listAcceptedSuggestions } from "../repos/acceptedSuggestions";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { AcceptedSuggestionsRead } from "../repos/acceptedSuggestions";

/**
 * The signed in user's live accepted suggestions for the week that starts on the Monday `weekStart`
 * (`YYYY-MM-DD`), as `{ suggestions, skipped }`: the rows core could read, and the ids and field paths
 * of the ones it could not, which the projection leaves out. Key `keys.training.acceptedSuggestions`.
 * What is cached is rows, kept in the mobile offline cache: the projection counts them as planned at
 * read time (`useWeekComparison` and the body map hooks read them here), so nothing worked out from
 * them is stored. `enabled` false makes no request at all. A date that is not a Monday fails without a
 * request, as an error that is not retried. A failed read names the action and the database code only.
 */
export function useAcceptedSuggestions(
  weekStart: string,
  { enabled = true }: DiaryReadOptions = {},
) {
  const client = useSupabase();

  return useQuery<AcceptedSuggestionsRead>({
    queryKey: keys.training.acceptedSuggestions(weekStart),
    queryFn: () => listAcceptedSuggestions(client, weekStart),
    enabled,
    retry: retryUnlessRangeError,
  });
}
