import type { LogContext } from "../../lib/navigation";

/** `own` is the sheet titled "Your foods", which lists and filters only the user's own foods. */
export type FoodSearchScope = "all" | "own";

/** What the sheet needs while food is being logged to a day, which is when it is opened with a `day`. */
export type FoodSearchLogging = {
  context: LogContext;
  /** Opens the quick add form. */
  onQuickAdd: () => void;
  /** Opens the portion picker for a Recent food, filled in with the amount it was last logged with. */
  onOpenRecent: (foodId: string) => void;
};

export type FoodSearchProps = {
  /** Defaults to `all`. */
  scope?: FoodSearchScope;
  onClose: () => void;
  onCreateFood: () => void;
  onScanBarcode: () => void;
  onOpenFood: (foodId: string) => void;
  /** Puts the sheet in log mode: titled "Log food", with servings and a plus on each row. Leave it out for the plain search. */
  logging?: FoodSearchLogging | undefined;
};
