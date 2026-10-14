/** `own` is the sheet titled "Your foods", which lists and filters only the user's own foods. */
export type FoodSearchScope = "all" | "own";

export type FoodSearchProps = {
  /** Defaults to `all`. */
  scope?: FoodSearchScope;
  onClose: () => void;
  onCreateFood: () => void;
  onScanBarcode: () => void;
  onOpenFood: (foodId: string) => void;
};
