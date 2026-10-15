export type MacroAmount = {
  /** Grams eaten. */
  eaten: number;
  /** The day's target in grams. Zero means no target: an empty bar and the grams only. */
  target: number;
};

export type MacroBarsProps = {
  protein: MacroAmount;
  carbs: MacroAmount;
  fat: MacroAmount;
  /** A shorter bar and smaller grams, for a tight card. Defaults to false. */
  compact?: boolean;
  className?: string;
};
