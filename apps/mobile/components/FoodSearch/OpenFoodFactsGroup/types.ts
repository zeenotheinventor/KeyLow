import type { OffCandidate } from "@keylow/core/schemas";

export type OpenFoodFactsGroupProps = {
  candidates: readonly OffCandidate[];
  /** The trimmed query, whose words are written in bold in each name. */
  query: string;
  /**
   * Lets the rows be pressed again as soon as the food has been handed on. The log search opens the food in a
   * route over the sheet and is released when the sheet regains focus; the ingredient search opens the amount
   * step over itself, so the sheet never loses focus and nothing else would release the rows.
   */
  releasesOnOpen?: boolean | undefined;
  /** Draws each row with the serving its product opens on, as the log and ingredient searches do. Leave it out for per 100 g. */
  showsServings?: boolean | undefined;
  onOpenFood: (foodId: string) => void;
};
