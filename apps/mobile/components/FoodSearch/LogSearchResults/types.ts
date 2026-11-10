import type { FoodSearchLogging } from "../types";

export type LogSearchResultsProps = {
  /** What the user has typed, untrimmed. */
  query: string;
  logging: FoodSearchLogging;
  /** How many food rows to draw, as the search results count them. */
  visibleRowCount: number;
  /** Says whether food rows are left to reveal. */
  onMoreRowsChange: (hasMoreRows: boolean) => void;
  onOpenFood: (foodId: string) => void;
  onCreateFood: () => void;
  /** Called when something has been put on the plate, from here or from another screen of the sheet, so the field can be emptied. */
  onPlateAdded: () => void;
};
