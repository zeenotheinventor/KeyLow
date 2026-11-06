export type MacroTileProps = {
  label: string;
  /** The macro's colour, shown as a small square beside the label and never as text. */
  colour: "protein" | "carbs" | "fat";
  /** Null when the source does not give it. */
  grams: number | null;
  /** A whole per cent of the food's energy, or null when it cannot be worked out. */
  share: number | null;
  /**
   * `detail` is the food page's tile, with the share as a caption. `amount` is the dialogs': the share is a
   * pill, first in a column from 700 px and at the end of a row below it. `row` is the amount tile kept as a
   * row at every width, for a card in a narrow column such as the recipe editor's.
   */
  variant?: "detail" | "amount" | "row";
  /** There is no valid amount, so the tile writes a dash in place of its value. */
  isBlank?: boolean;
};
