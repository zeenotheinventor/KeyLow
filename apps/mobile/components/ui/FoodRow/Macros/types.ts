import type { FoodRowMacros } from "../types";

export type MacrosProps = {
  /** The macros, drawn as marks with their letters. Leave them out when a food needs review. */
  macros?: FoodRowMacros | undefined;
  /** What the macros are per, when it is not 100 g. */
  basis?: string | undefined;
  /**
   * The energy as `formatCalories` writes it. It turns the line into the stats line: a flame in the
   * calories colour with the energy and a muted kcal, then the macros. The stats line may wrap between
   * its items, never inside one.
   */
  energy?: string | undefined;
  /** Writes the review flag in place of the macros. Only for the stats line. */
  needsReview?: boolean | undefined;
};
