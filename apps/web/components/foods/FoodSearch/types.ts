export type FoodSearchProps = {
  /** `own` is the page titled "Your foods", which lists and filters only the user's own foods. */
  scope?: "all" | "own";
  /** Opens the barcode panel at once, as the top bar's barcode button asks. */
  startWithBarcodePanel?: boolean;
  /** The day a food found by barcode is added to, `YYYY-MM-DD`. Left out, it is today. */
  day?: string | undefined;
};
