import type { RecipeCard } from "@keylow/core/recipes";

export type PerServingCardProps = {
  /** What core works out for the draft, or null while there is nothing to work out (no ingredients, or servings that are not a number above 0). */
  card: RecipeCard | null;
};
