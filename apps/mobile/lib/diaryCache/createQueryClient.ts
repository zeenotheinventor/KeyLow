import { QueryClient } from "@tanstack/react-query";

import { DIARY_CACHE_MAX_AGE_MS } from "./constants";
import { PERSISTED_QUERY_KEYS } from "./persistedQueryKeys";

/**
 * The phone's query client. The queries the cache keeps are held in memory as long as they may be
 * stored: with react-query's default of five minutes a day looked at earlier would be dropped from
 * memory, and the next save would drop it from storage too.
 */
export function createQueryClient(): QueryClient {
  const queryClient = new QueryClient();

  for (const queryKey of PERSISTED_QUERY_KEYS) {
    queryClient.setQueryDefaults(queryKey, { gcTime: DIARY_CACHE_MAX_AGE_MS });
  }

  return queryClient;
}
