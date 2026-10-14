import type { HighlightSegment } from "@keylow/core/search";

/** The macros as the row writes them, in grams, with a sentence for a screen reader. */
export type FoodRowMacros = {
  protein: string;
  carbs: string;
  fat: string;
  /** Spells the macros out, such as "protein 31 grams, fat 3.6 grams, carbohydrate 0 grams". */
  description: string;
};

/**
 * A food on the search and Your foods lists. Every text is given already written: the row never
 * formats an amount or matches a name, so the name comes from `highlightMatch`, the amounts from
 * `formatGrams` and `formatCalories`, and the sentence from `describeMacros`.
 */
export type FoodRowProps = {
  /** The name cut into the parts that match the search and the parts that do not. */
  nameSegments: readonly HighlightSegment[];
  brand?: string | undefined;
  /** The energy in kcal. Leave it out when the food has none. */
  energy?: string | undefined;
  macros?: FoodRowMacros | undefined;
  /** What the macros are per when it is not 100 g, such as "per 100 ml". */
  basis?: string | undefined;
  /** Takes the place of the macros, such as "Energy not given". */
  note?: string | undefined;
  /** Says what is happening, such as "Adding to your foods". The row is busy while it is set. */
  busyLabel?: string | undefined;
  /** Dims the row to half and stops it responding. A busy row is not dimmed: the rows around it are. */
  disabled?: boolean | undefined;
  onPress: () => void;
};
