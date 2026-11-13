import type { FitTolerance } from "./types";

/** Zee's ruling of 2026-11-13: 5 % on calories, 5 g on protein, and 5 g on carbs or fat when named. */
export const FIT_TOLERANCE: FitTolerance = {
  kcalPercent: 5,
  proteinGrams: 5,
  macroGrams: 5,
};
