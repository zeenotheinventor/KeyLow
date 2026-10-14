/** A part of the food's name. Matched parts are the ones that match the search. */
export type FoodNameSegment = { text: string; matched: boolean };

/** The macros as written on the row, in grams, with a sentence for a screen reader. */
export type FoodRowMacros = {
  protein: string;
  carbs: string;
  fat: string;
  /** Spells the macros out, such as "protein 31 grams, fat 3.6 grams, carbohydrate 0 grams". */
  description: string;
};

export type FoodRowContent = {
  nameSegments: readonly FoodNameSegment[];
  brand?: string;
  /** The energy, already formatted, in kcal. */
  energy?: string;
  macros?: FoodRowMacros;
  /** What the macros are per when it is not 100 g, such as "per 100 ml". */
  basis?: string;
  /** Takes the place of the macros, such as "Energy not given". */
  note?: string;
  /** Says what is happening, such as "Adding to your foods". The row is busy while it is set. */
  busyLabel?: string;
  disabled?: boolean;
  className?: string;
};

/** A row either goes to the food's page or runs an action, such as adding the product. */
export type FoodRowProps = FoodRowContent &
  ({ href: string; onClick?: never } | { onClick: () => void; href?: never });
