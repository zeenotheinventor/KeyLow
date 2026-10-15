import { macroKcal } from "./macroKcal";

import type { EnteredNumber } from "./validation";

/** The quick add warns when the macros are further than this share of the calories from them. */
export const MACRO_MISMATCH_SHARE_OF_CALORIES = 0.25;

/**
 * True when at least one macro is given, the calories are above 0, and the energy the macros add up
 * to is more than 25 % of the calories away from them, in either direction.
 */
export const macrosDisagreeWithCalories = (
  kcal: EnteredNumber,
  proteinGrams: EnteredNumber,
  fatGrams: EnteredNumber,
  carbohydrateGrams: EnteredNumber,
): boolean => {
  const anyMacroGiven = [proteinGrams, fatGrams, carbohydrateGrams].some((grams) => grams !== null);
  if (!anyMacroGiven || kcal === null || !(kcal > 0)) {
    return false;
  }
  const difference = Math.abs(macroKcal(proteinGrams, fatGrams, carbohydrateGrams) - kcal);
  return difference > kcal * MACRO_MISMATCH_SHARE_OF_CALORIES;
};
