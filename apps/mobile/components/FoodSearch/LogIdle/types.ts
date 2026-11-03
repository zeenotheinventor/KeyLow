import type { RecentFoodsProps } from "../RecentFoods";

export type LogIdleProps = RecentFoodsProps & {
  /** Opens the quick add form, with the day and the hour the sheet was opened for. */
  onQuickAdd: () => void;
  /** Opens the assistant sheet to describe what was eaten, to be logged at this day and time. */
  onDescribe: () => void;
  /** Opens the portion picker for a favourite food, as pressing a Recent row does. */
  onOpenFavouriteFood: (foodId: string) => void;
  /** Opens the amount step for a favourite recipe, as pressing a recipe row does. */
  onOpenFavouriteRecipe: (recipeId: string) => void;
};
