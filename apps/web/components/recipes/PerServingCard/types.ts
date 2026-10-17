import type { RecipeCard } from "@keylow/core/recipes";

export type PerServingCardProps = {
  /** What `recipeCardOf` works out, or null while there is nothing to work out. */
  card: RecipeCard | null;
};
