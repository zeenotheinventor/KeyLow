import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useDebouncedValue } from "./useDebouncedValue";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { MIN_SEARCH_LENGTH } from "../repos/foods";
import { searchRecipes } from "../repos/recipes";

import type { RecipeSummary } from "../repos/recipes";

const STALE_TIME_MS = 30 * 1000;
const NO_RECIPES: RecipeSummary[] = [];

export type UseRecipeSearchOptions = {
  /** How many recipes to ask for, 1 to 50. Defaults to 25. */
  limit?: number;
  /** True also searches archived recipes. Defaults to false, live recipes only. */
  archived?: boolean;
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
export type RecipeSearchError = {
  kind: "failed";
  /** The action and the error code. */
  debugMessage: string;
};

export type RecipeSearchResult = {
  /** The user's recipes whose name contains the query, in the library's order. */
  recipes: RecipeSummary[];
  /** True until the first results arrive, and while the next query replaces the ones on show. */
  isLoading: boolean;
  /**
   * True from the moment the query changes until it has stayed unchanged for `debounceMs` and so starts
   * to be searched. In that gap the recipes on show still belong to the previous query, so a screen
   * should not read an empty list as "no matches": the user has typed and the search is waiting. Always
   * false when `enabled` is false, and when only the whitespace around the query changed.
   */
  isDebouncing: boolean;
  /** Set when the search failed, so the screen can tell a failure from "no matches". */
  error: RecipeSearchError | null;
};

/**
 * Searches the user's recipes by name. The trimmed query is debounced and searched from 2 characters,
 * and `%` and `_` in it match as themselves. The recipes of the previous query stay in view while the
 * next one loads, and a failed refetch keeps the recipes already on show. `limit` is part of no cache
 * key, so keep it stable per screen. Key `keys.recipes.search(query, archived)`.
 */
export function useRecipeSearch(
  query: string,
  { limit = 25, archived = false, debounceMs = 250, enabled = true }: UseRecipeSearchOptions = {},
): RecipeSearchResult {
  const client = useSupabase();
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, debounceMs);
  const isDebouncing = enabled && trimmedQuery !== debouncedQuery;
  const isSearchable = enabled && debouncedQuery.length >= MIN_SEARCH_LENGTH;

  const search = useQuery({
    queryKey: keys.recipes.search(debouncedQuery, archived),
    queryFn: () => searchRecipes(client, debouncedQuery, { archived, limit }),
    enabled: isSearchable,
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME_MS,
  });

  if (!isSearchable) {
    return { recipes: NO_RECIPES, isLoading: false, isDebouncing, error: null };
  }

  return {
    recipes: search.data ?? NO_RECIPES,
    isLoading: search.isLoading || search.isPlaceholderData,
    isDebouncing,
    error: search.error === null ? null : { kind: "failed", debugMessage: search.error.message },
  };
}
