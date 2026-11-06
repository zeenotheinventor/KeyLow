import type { RecentFood, RecipeSummary } from "@keylow/api-client";

export type FavouriteFoodsProps = {
  /** A press on a favourite food that Recent does not hold: go to the portion step at its default amount. */
  onOpenFood: (foodId: string) => void;
  /** A press on a favourite food that Recent holds: go to the portion step at the amount last logged. */
  onOpenRecent: (food: RecentFood) => void;
  /** A press on a favourite recipe: go to the recipe amount step. */
  onOpenRecipe: (recipe: RecipeSummary) => void;
};
