import type { FoodSearchResult } from "@keylow/api-client";

export type FoodSearchProps = {
  /** What the user has typed. */
  query: string;
  /** The trimmed query the results are for, which trails `query` while the typing settles. */
  searchedQuery: string;
  onQueryChange: (query: string) => void;
  results: FoodSearchResult;
  /** The code of the Open Food Facts product being added, while it is being added. */
  pendingCandidateCode: string | undefined;
  /** Why adding an Open Food Facts product failed, shown in that section. */
  candidateError: string | undefined;
  onSelectFood: (foodId: string) => void;
  onSelectCandidate: (code: string) => void;
  onCreateFood: () => void;
  onScanBarcode: () => void;
};
