import type { FoodSearchGroupKey } from "@keylow/core/search";

export type SearchResultsProps = {
  /** The trimmed text to search for, long enough to be searched. */
  query: string;
};

/** The groups the user has opened with "See N more", and the query they were opened for. */
export type Expansion = { query: string; groups: readonly FoodSearchGroupKey[] };
