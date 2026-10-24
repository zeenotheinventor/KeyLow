export type MacroTileMacro = "protein" | "carbs" | "fat";

export type MacroTileProps = {
  /** The macro's name: "Protein", "Carbs" or "Fat". */
  label: string;
  /** Which macro it is, for its colour. */
  macro: MacroTileMacro;
  /** The grams per 100 g or 100 ml, or null when the source does not give them. */
  grams: number | null;
  /** A whole per cent of the food's energy, or null when it cannot be worked out. Never drawn for a missing macro. */
  share: number | null;
  /**
   * Draws a dash in place of the grams, for the portion picker while there is no valid amount. The tile is
   * then named "Protein, no amount". Defaults to false.
   */
  isBlank?: boolean;
};
