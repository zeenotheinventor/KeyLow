import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useDebouncedValue } from "./useDebouncedValue";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { searchExercises } from "../repos/exercises";
import { MIN_SEARCH_LENGTH } from "../repos/foods";

import type { ExerciseSearchHit } from "../repos/exercises";

const STALE_TIME_MS = 30 * 1000;
const NO_EXERCISES: ExerciseSearchHit[] = [];

export type UseExerciseSearchOptions = {
  /** How many exercises to ask for, 1 to 50. Defaults to 25. */
  limit?: number;
  /** How long the query must stay unchanged before it is searched. Defaults to 250. */
  debounceMs?: number;
  /**
   * The same option the diary reads take: false makes no request at all. The mobile app passes
   * `useReadsEnabled()` from the screens, since the `(tabs)` stay mounted under the terms gate.
   * Defaults to true.
   */
  enabled?: boolean;
};

/** Why the search failed. Its text is for logs and bug reports and the UI must never render it. */
export type ExerciseSearchError = {
  kind: "failed";
  /** The action and the error code. */
  debugMessage: string;
};

export type ExerciseSearchResult = {
  /** The exercises whose name contains the query: the user's own first, then the library by name. */
  exercises: ExerciseSearchHit[];
  /** True until the first results arrive, and while the next query replaces the ones on show. */
  isLoading: boolean;
  /**
   * True from the moment the query changes until it has stayed unchanged for `debounceMs` and so starts
   * to be searched. In that gap the exercises on show still belong to the previous query, so a screen
   * should not read an empty list as "no matches". Always false when `enabled` is false, and when only
   * the whitespace around the query changed.
   */
  isDebouncing: boolean;
  /** Set when the search failed, so the screen can tell a failure from "no matches". */
  error: ExerciseSearchError | null;
};

/**
 * Searches the exercises by name: the user's own first, then the library. The trimmed query is debounced
 * and searched from 2 characters, and `%` and `_` in it match as themselves. The exercises of the
 * previous query stay in view while the next one loads, and a failed refetch keeps the exercises already
 * on show. `limit` is part of no cache key, so keep it stable per screen. Key
 * `keys.training.exerciseSearch(query)`. It is never kept in the mobile cache: searching needs a
 * connection, as logging does.
 */
export function useExerciseSearch(
  query: string,
  { limit = 25, debounceMs = 250, enabled = true }: UseExerciseSearchOptions = {},
): ExerciseSearchResult {
  const client = useSupabase();
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, debounceMs);
  const isDebouncing = enabled && trimmedQuery !== debouncedQuery;
  const isSearchable = enabled && debouncedQuery.length >= MIN_SEARCH_LENGTH;

  const search = useQuery({
    queryKey: keys.training.exerciseSearch(debouncedQuery),
    queryFn: () => searchExercises(client, debouncedQuery, { limit }),
    enabled: isSearchable,
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME_MS,
  });

  if (!isSearchable) {
    return { exercises: NO_EXERCISES, isLoading: false, isDebouncing, error: null };
  }

  return {
    exercises: search.data ?? NO_EXERCISES,
    isLoading: search.isLoading || search.isPlaceholderData,
    isDebouncing,
    error: search.error === null ? null : { kind: "failed", debugMessage: search.error.message },
  };
}
