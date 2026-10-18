import { keys } from "@keylow/api-client";

import { isPersistedQuery } from "./isPersistedQuery";
import { queryKeyStartsWith } from "./queryKeyStartsWith";

import type { Query, QueryClient } from "@tanstack/react-query";

/**
 * The sets read most recently that the cache would keep, whatever start day it is keyed by. The key
 * holds the day the read started on, so every day adds one, and the hook's offline stand-in only ever
 * needs the newest.
 */
function newestSetsRead(queryClient: QueryClient): Query | undefined {
  return queryClient
    .getQueryCache()
    .findAll({ queryKey: keys.training.setsAll })
    .filter(isPersistedQuery)
    .reduce<Query | undefined>(
      (newest, query) =>
        newest === undefined || query.state.dataUpdatedAt > newest.state.dataUpdatedAt
          ? query
          : newest,
      undefined,
    );
}

/**
 * Which queries a save stores: what `isPersistedQuery` keeps, except that of the sets reads only the
 * newest is stored. Without it a week of days would leave up to seven near-identical copies of the
 * snapshots of about 15 days of sets on the phone.
 */
export function createShouldDehydrateQuery(queryClient: QueryClient) {
  return (query: Query): boolean => {
    if (!isPersistedQuery(query)) {
      return false;
    }
    if (!queryKeyStartsWith(query.queryKey, keys.training.setsAll)) {
      return true;
    }

    return query === newestSetsRead(queryClient);
  };
}
