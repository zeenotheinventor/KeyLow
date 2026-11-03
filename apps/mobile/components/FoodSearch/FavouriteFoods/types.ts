export type FavouriteFoodsProps = {
  /** Opens the portion picker for a favourite food, on the amount it was last logged with when there is one. */
  onOpenFood: (foodId: string) => void;
  /** Opens the amount step for a favourite recipe. */
  onOpenRecipe: (recipeId: string) => void;
};
