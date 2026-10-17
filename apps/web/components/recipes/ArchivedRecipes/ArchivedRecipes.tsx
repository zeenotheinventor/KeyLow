"use client";

import { useRecipes } from "@keylow/api-client";

import { ArchivedRecipesView } from "../ArchivedRecipesView";

import { useRecipeActions } from "@/lib/recipeActions";

/**
 * The archived recipes page: the recipes the user has put away, from the same single request as the
 * library, with Restore from the shared recipe actions. A failed refetch keeps the recipes already loaded,
 * so only a page that never loaded is an error.
 */
export function ArchivedRecipes() {
  const recipes = useRecipes({ archived: true });
  const actions = useRecipeActions();

  if (recipes.data !== undefined) {
    return (
      <ArchivedRecipesView
        status="ready"
        recipes={recipes.data.filter((recipe) => recipe.is_archived)}
        onRestore={(recipe) => {
          actions.restore(recipe);
        }}
      />
    );
  }

  if (recipes.isError) {
    return (
      <ArchivedRecipesView
        status="error"
        onRetry={() => {
          void recipes.refetch();
        }}
      />
    );
  }

  return <ArchivedRecipesView status="loading" />;
}
