export type MacroTileProps = {
  label: string;
  /** The macro's colour, shown as a small square beside the label and never as text. */
  colour: "protein" | "carbs" | "fat";
  /** Null when the source does not give it. */
  grams: number | null;
  /** A whole per cent of the food's energy, or null when it cannot be worked out. */
  share: number | null;
};
