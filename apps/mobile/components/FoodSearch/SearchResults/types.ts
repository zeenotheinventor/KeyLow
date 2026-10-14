import type { FoodSearchGroupKey } from "@keylow/core/search";

export type SearchResultsProps = {
  /** What the user has typed, untrimmed. */
  query: string;
  onOpenFood: (foodId: string) => void;
  onCreateFood: () => void;
};

/** The groups the user has opened with "See N more", and the query they were opened for. */
export type Expansion = { query: string; groups: readonly FoodSearchGroupKey[] };
