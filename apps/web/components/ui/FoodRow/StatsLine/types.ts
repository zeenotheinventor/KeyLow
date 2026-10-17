import type { FoodRowMacroValues } from "../types";

export type StatsLineProps = {
  /** The energy as `formatCalories` writes it. Leave it out for a food that has none. */
  energy?: string | undefined;
  /** The macros, drawn as marks with their letters. Without them, or with `needsReview`, the line says the food needs review. */
  macros?: FoodRowMacroValues | undefined;
  needsReview?: boolean | undefined;
};
