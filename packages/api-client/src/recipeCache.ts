import { keys } from "./queryKeys";

import type { RecipeDetail, RecipeSummary } from "./repos/recipes";
import type { QueryClient } from "@tanstack/react-query";

/** Puts a stored recipe in the cache of its own screen, so a screen that opens it next has it at once. */
export function putRecipeInCache(queryClient: QueryClient, recipe: RecipeDetail): void {
  queryClient.setQueryData(keys.recipes.detail(recipe.id), recipe);
}

/**
 * Marks the library, every recipe and every search stale after a write. Only `keys.recipes.all` is
 * touched: saving a recipe never reads, writes or refreshes a diary query, because a past entry never
 * changes when a recipe does.
 */
export function refreshRecipes(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: keys.recipes.all });
}

// The library reads archived recipes with the live ones in one request, so every recipe is in this list.
const libraryKey = keys.recipes.list(true);

/** A saved recipe as the library lists it: the lean columns, without its ingredients or steps. */
export const summaryOf = ({
  id,
  name,
  servings,
  yield_grams,
  is_archived,
  computed,
}: RecipeDetail): RecipeSummary => ({ id, name, servings, yield_grams, is_archived, computed });

/** The names in the library read, archived recipes included, or none when it has not been read yet. */
export function libraryNames(queryClient: QueryClient): string[] {
  return (queryClient.getQueryData<RecipeSummary[]>(libraryKey) ?? []).map(({ name }) => name);
}

/**
 * Sets the archived flag of one recipe in the cached library, so its row leaves or returns at once.
 * Returns the rollback for a write that fails: it puts back the flag the recipe had before.
 */
export function setLibraryFlag(
  queryClient: QueryClient,
  id: string,
  isArchived: boolean,
): () => void {
  const previous = queryClient
    .getQueryData<RecipeSummary[]>(libraryKey)
    ?.find((recipe) => recipe.id === id)?.is_archived;
  const set = (flag: boolean) => {
    queryClient.setQueryData<RecipeSummary[]>(libraryKey, (recipes) =>
      recipes?.map((recipe) => (recipe.id === id ? { ...recipe, is_archived: flag } : recipe)),
    );
  };
  set(isArchived);
  return () => {
    if (previous !== undefined) {
      set(previous);
    }
  };
}

/** Puts a copy in the cached library straight after its original, until a fresh read puts it in name order. */
export function addToLibrary(
  queryClient: QueryClient,
  originalId: string,
  copy: RecipeSummary,
): void {
  queryClient.setQueryData<RecipeSummary[]>(libraryKey, (recipes) => {
    // The library may have been read again already, and then the copy is in it.
    if (recipes === undefined || recipes.some((recipe) => recipe.id === copy.id)) {
      return recipes;
    }
    const at = recipes.findIndex((recipe) => recipe.id === originalId) + 1;
    return [...recipes.slice(0, at), copy, ...recipes.slice(at)];
  });
}
