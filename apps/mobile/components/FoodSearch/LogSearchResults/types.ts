import type { FoodSearchLogging } from "../types";

export type LogSearchResultsProps = {
  /** What the user has typed, untrimmed. */
  query: string;
  logging: FoodSearchLogging;
  onOpenFood: (foodId: string) => void;
  onCreateFood: () => void;
};
