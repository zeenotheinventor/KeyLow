import type { FoodSearchIngredient } from "../types";

export type IngredientSearchResultsProps = FoodSearchIngredient & {
  /** What the user has typed, untrimmed. */
  query: string;
  /** How many food rows to draw, as the search results count them. */
  visibleRowCount: number;
  /** Says whether food rows are left to reveal. */
  onMoreRowsChange: (hasMoreRows: boolean) => void;
  /** Opens the amount step for a food from the results. */
  onOpenFood: (foodId: string) => void;
};
