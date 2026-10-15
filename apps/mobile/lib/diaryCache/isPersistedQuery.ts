import { DIARY_CACHE_MAX_AGE_MS } from "./constants";
import { PERSISTED_QUERY_KEYS } from "./persistedQueryKeys";

import type { Query } from "@tanstack/react-query";

const startsWith = (queryKey: readonly unknown[], prefix: readonly unknown[]) =>
  prefix.every((part, index) => queryKey[index] === part);

/**
 * Whether the cache keeps a query: it is one of the persisted families, it holds data, and the data is
 * no older than the cache may be kept. The age check stops a day looked at long ago from being
 * rewritten with every save, so the stored cache stays small.
 */
export function isPersistedQuery(query: Query): boolean {
  return (
    query.state.status === "success" &&
    Date.now() - query.state.dataUpdatedAt <= DIARY_CACHE_MAX_AGE_MS &&
    PERSISTED_QUERY_KEYS.some((prefix) => startsWith(query.queryKey, prefix))
  );
}
