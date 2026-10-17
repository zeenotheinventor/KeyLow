"use client";

import { useRecipes } from "@keylow/api-client";

import { RecipeLibraryView } from "../RecipeLibraryView";

/**
 * The recipe library: the user's live recipes, read with one request that also brings the archived ones
 * for the archived page, which are left out here. A failed refetch keeps the recipes already loaded, so
 * only a library that never loaded is an error.
 */
export function RecipeLibrary() {
  const recipes = useRecipes({ archived: true });

  if (recipes.data !== undefined) {
    return (
      <RecipeLibraryView
        status="ready"
        recipes={recipes.data.filter((recipe) => !recipe.is_archived)}
      />
    );
  }

  if (recipes.isError) {
    return (
      <RecipeLibraryView
        status="error"
        onRetry={() => {
          void recipes.refetch();
        }}
      />
    );
  }

  return <RecipeLibraryView status="loading" />;
}
