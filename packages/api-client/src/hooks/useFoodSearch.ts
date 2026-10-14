import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useDebouncedValue } from "./useDebouncedValue";
import { RateLimitedError, toEdgeErrorKind } from "../errors";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { MIN_SEARCH_LENGTH, searchFoods } from "../repos/foods";
import { searchOff } from "../repos/off";

import type { EdgeErrorKind } from "../errors";
import type { FoodSearchHit } from "../repos/foods";
import type { OffCandidate } from "@keylow/core/schemas";

const LOCAL_STALE_TIME_MS = 30 * 1000;
// Open Food Facts allows few searches a minute, so a repeated query is served from the cache for
// this long. The cache entry must outlive its stale time, or it would be dropped before it counts.
const OFF_CACHE_TIME_MS = 10 * 60 * 1000;
const NO_CANDIDATES: OffCandidate[] = [];

export type UseFoodSearchOptions = {
  /** How many local foods to ask for, 1 to 50. Defaults to 25. */
  limit?: number;
  /** Open Food Facts is searched when the local search finds fewer foods than this. Defaults to 5. */
  offThreshold?: number;
  /** How long the query must stay unchanged before it is searched. Defaults to 250. */
  debounceMs?: number;
  /** Set to false to make no request at all. Defaults to true. */
  enabled?: boolean;
};

/**
 * Why a call to an Edge Function gave nothing, which is what Open Food Facts searches and barcode
 * lookups are. The screen shows words for `kind` (through `describeEdgeError`) and never the raw text.
 *
 * The hooks always set `debugMessage` and `message`. They are optional in the type only so that the
 * fixtures the apps wrote before `debugMessage` existed still typecheck, and KEY-113 tightens them.
 */
export type FoodSearchOffError = {
  kind: EdgeErrorKind;
  /** Only with `rate_limited`, and only when the server said how long to wait. */
  retryAfterSeconds?: number;
  /**
   * The raw text of the failure, for logs and bug reports only. It can carry upstream or database
   * wording that means nothing to the user, so the UI must never render it.
   */
  debugMessage?: string;
  /**
   * The same text as `debugMessage`, so it is not for the UI either. It stays only until the
   * screens stop reading it, and KEY-113 removes it. It is not marked deprecated because that
   * would fail the lint of the apps that still read it.
   */
  message?: string;
};

/**
 * Why the local search failed. Like `FoodSearchOffError`, its text is for logs and never for the UI,
 * and the hooks always set `kind` and `debugMessage`, which are optional in the type for the same reason.
 */
export type FoodSearchLocalError = {
  kind?: "failed";
  /** The raw text of the failure, for logs and bug reports only. The UI must never render it. */
  debugMessage?: string;
  /** The same text as `debugMessage`, so it is not for the UI either. KEY-113 removes it. */
  message: string;
};

export type FoodSearchResult = {
  /** The user's own and the shared foods that match, best first. */
  local: FoodSearchHit[];
  /** Open Food Facts candidates, only searched for when the local search found few foods. */
  off: OffCandidate[];
  /** True until the first local results arrive, and while the next query replaces the ones on show. */
  isLoadingLocal: boolean;
  /**
   * True while Open Food Facts is being searched for the current query, and while the candidates of
   * the previous query are on show until the next local search settles. False while the local search
   * is still loading and Open Food Facts has never been asked.
   */
  isLoadingOff: boolean;
  /**
   * True from the moment the query changes until it has stayed unchanged for `debounceMs` and so
   * starts to be searched. In that gap the results on show still belong to the previous query, so a
   * screen should not read an empty list as "no matches yet": the user has typed and the search is
   * waiting. With `debounceMs: 0` the gap lasts a single render. Always false when `enabled` is
   * false, and when only the whitespace around the query changed, since neither starts a search.
   * The hook always sets it. It is optional in the type only so that the results the apps mock
   * before this field existed still typecheck, and KEY-113 makes it required.
   */
  isDebouncing?: boolean;
  offError: FoodSearchOffError | null;
  /** Set when the local search failed, so the screen can tell a failure from "no matches". */
  localError: FoodSearchLocalError | null;
};

export function toOffError(error: Error | null): FoodSearchOffError | null {
  if (error === null) {
    return null;
  }

  const kind = toEdgeErrorKind(error);
  const base = { kind, debugMessage: error.message, message: error.message };

  return error instanceof RateLimitedError && error.retryAfterSeconds !== undefined
    ? { ...base, retryAfterSeconds: error.retryAfterSeconds }
    : base;
}

/**
 * The food search flow: the local `search_foods` RPC first, and Open Food Facts candidates in a
 * separate list only when the settled local search found fewer than `offThreshold` foods. The
 * trimmed query is debounced and searched from 2 characters. Results of the previous query stay in
 * view while the next one loads. `limit` is part of no cache key, so keep it stable per screen.
 */
export function useFoodSearch(query: string, options: UseFoodSearchOptions = {}): FoodSearchResult {
  const { limit = 25, offThreshold = 5, debounceMs = 250, enabled = true } = options;
  const client = useSupabase();
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, debounceMs);
  const isDebouncing = enabled && trimmedQuery !== debouncedQuery;
  const isSearchable = enabled && debouncedQuery.length >= MIN_SEARCH_LENGTH;

  const localQuery = useQuery({
    queryKey: keys.foods.search(debouncedQuery),
    queryFn: () => searchFoods(client, debouncedQuery, limit),
    enabled: isSearchable,
    placeholderData: keepPreviousData,
    staleTime: LOCAL_STALE_TIME_MS,
  });

  // While the data is a placeholder the local query for this exact string has not settled yet.
  const isLocalSettled = localQuery.isSuccess && !localQuery.isPlaceholderData;
  const isOffSearchNeeded = isSearchable && isLocalSettled && localQuery.data.length < offThreshold;

  // The candidates now on show. They stand in for the next query's while it loads, and only then:
  // once they go out of view they are forgotten, so they cannot come back two queries later.
  const [candidatesOnShow, setCandidatesOnShow] = useState(NO_CANDIDATES);

  const offQuery = useQuery({
    queryKey: keys.foods.offSearch(debouncedQuery),
    queryFn: () => searchOff(client, debouncedQuery),
    enabled: isOffSearchNeeded,
    staleTime: OFF_CACHE_TIME_MS,
    gcTime: OFF_CACHE_TIME_MS,
    placeholderData: () => (candidatesOnShow.length > 0 ? candidatesOnShow : undefined),
    // Each attempt spends the user's few searches a minute, and a rate limit will not pass by retrying,
    // so a failed search is not retried and is not repeated when the window regains focus or the network returns.
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // The candidates of the previous query stay visible while the local search for the next one is
  // loading, but are dropped once that search settles with enough local foods.
  const isOffInView = isSearchable && (isOffSearchNeeded || localQuery.isPlaceholderData);
  const off = isOffInView ? (offQuery.data ?? NO_CANDIDATES) : NO_CANDIDATES;

  if (off !== candidatesOnShow) {
    setCandidatesOnShow(off);
  }

  if (!isSearchable) {
    return {
      local: [],
      off: NO_CANDIDATES,
      isLoadingLocal: false,
      isLoadingOff: false,
      isDebouncing,
      offError: null,
      localError: null,
    };
  }

  return {
    local: localQuery.data ?? [],
    off,
    isLoadingLocal: localQuery.isLoading || localQuery.isPlaceholderData,
    isLoadingOff: isOffInView && (offQuery.isLoading || offQuery.isPlaceholderData),
    isDebouncing,
    offError: isOffSearchNeeded ? toOffError(offQuery.error) : null,
    localError:
      localQuery.error === null
        ? null
        : {
            kind: "failed",
            debugMessage: localQuery.error.message,
            message: localQuery.error.message,
          },
  };
}
