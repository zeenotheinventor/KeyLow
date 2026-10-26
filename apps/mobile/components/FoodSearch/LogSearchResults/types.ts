import type { FoodSearchLogging } from "../types";

export type LogSearchResultsProps = {
  /** What the user has typed, untrimmed. */
  query: string;
  logging: FoodSearchLogging;
  onOpenFood: (foodId: string) => void;
  onCreateFood: () => void;
  /** Called when something has been put on the plate, from here or from another screen of the sheet, so the field can be emptied. */
  onPlateAdded: () => void;
};
