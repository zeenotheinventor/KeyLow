import type { StoredRecipe } from "@keylow/core/recipes";

/** A saved recipe as the view opens it: what `useRecipe` returns, of which only these fields matter. */
export type RecipeViewRecipe = StoredRecipe & { id: string };

export type RecipeViewProps = {
  recipe: RecipeViewRecipe;
};
