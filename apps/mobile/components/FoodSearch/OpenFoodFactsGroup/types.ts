import type { OffCandidate } from "@keylow/core/schemas";

export type OpenFoodFactsGroupProps = {
  candidates: readonly OffCandidate[];
  /** The trimmed query, whose words are written in bold in each name. */
  query: string;
  onOpenFood: (foodId: string) => void;
};
