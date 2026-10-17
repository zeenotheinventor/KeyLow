import type { FoodSearchIngredient } from "../types";

export type IngredientSearchResultsProps = FoodSearchIngredient & {
  /** What the user has typed, untrimmed. */
  query: string;
  /** Opens the amount step for a food from the results. */
  onOpenFood: (foodId: string) => void;
};
