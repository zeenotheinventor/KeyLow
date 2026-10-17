"use client";

import { useRecipes } from "@keylow/api-client";

import { RecipeLibraryView } from "../RecipeLibraryView";

import { useRecipeActions } from "@/lib/recipeActions";

/**
 * The recipe library: the user's live recipes, read with one request that also brings the archived ones,
 * which are counted for the link to the archived page and not listed. A failed refetch keeps the recipes
 * already loaded, so only a library that never loaded is an error. The row buttons are the shared recipe
 * actions.
 */
export function RecipeLibrary() {
  const recipes = useRecipes({ archived: true });
  const actions = useRecipeActions();

  if (recipes.data !== undefined) {
    return (
      <RecipeLibraryView
        status="ready"
        recipes={recipes.data.filter((recipe) => !recipe.is_archived)}
        archivedCount={recipes.data.filter((recipe) => recipe.is_archived).length}
        isDuplicating={actions.isDuplicating}
        onDuplicate={(recipe) => {
          actions.duplicate(recipe);
        }}
        onArchive={(recipe) => {
          actions.archive(recipe);
        }}
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
