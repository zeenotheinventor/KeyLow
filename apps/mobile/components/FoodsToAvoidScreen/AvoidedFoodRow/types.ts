export type AvoidedFoodRowProps = {
  /** The word as the person typed it. */
  label: string;
  kind: "dislike" | "allergy";
  /** Draws the hairline above the row, which every row but the first has. */
  hasDivider: boolean;
  onRemove: () => void;
};
