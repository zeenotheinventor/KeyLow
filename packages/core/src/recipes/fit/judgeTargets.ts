import { FIT_TOLERANCE } from "./fitTolerance";

import type { FitNutrient, FitTarget, FitTolerance } from "./types";
import type { NullableNutrients } from "../../schemas/nutrients";

/** The nutrients a target can name, in the order misses are reported. */
export const FIT_NUTRIENTS: readonly FitNutrient[] = ["kcal", "protein_g", "carbs_g", "fat_g"];

/** Float noise allowance when judging a figure against its tolerance. */
export const TOLERANCE_EPSILON = 1e-9;

/** How far from `target` a figure may be and still count: calories by percent, the rest in grams. */
export const toleranceOf = (
  nutrient: FitNutrient,
  target: number,
  tolerance: FitTolerance = FIT_TOLERANCE,
): number => {
  if (nutrient === "kcal") {
    return (target * tolerance.kcalPercent) / 100;
  }
  return nutrient === "protein_g" ? tolerance.proteinGrams : tolerance.macroGrams;
};

/** A named target that a recipe's figure does not meet. `achieved` is null when no ingredient has data for it. */
export type TargetShortfall = {
  nutrient: FitNutrient;
  target: number;
  achieved: number | null;
};

/**
 * The named targets that `perServing` does not meet, judged by the one rule the fitter, the planner and the
 * evals share: calories within `kcalPercent` of the target, protein within `proteinGrams`, carbs and fat within
 * `macroGrams`. A nutrient that is not named is not judged. A named nutrient that is null in `perServing`
 * (no ingredient has data for it) is never met, so missing data is never read as a hit.
 */
export const outOfTolerance = (
  perServing: NullableNutrients,
  target: FitTarget,
  tolerance: FitTolerance = FIT_TOLERANCE,
): TargetShortfall[] =>
  FIT_NUTRIENTS.flatMap((nutrient) => {
    const wanted = target[nutrient];
    if (wanted === undefined) {
      return [];
    }
    const achieved = perServing[nutrient];
    const isMet =
      achieved !== null &&
      Math.abs(achieved - wanted) <= toleranceOf(nutrient, wanted, tolerance) + TOLERANCE_EPSILON;
    return isMet ? [] : [{ nutrient, target: wanted, achieved }];
  });

/** True when every named target is met by `perServing`. See `outOfTolerance`. */
export const isWithinTolerance = (
  perServing: NullableNutrients,
  target: FitTarget,
  tolerance: FitTolerance = FIT_TOLERANCE,
): boolean => outOfTolerance(perServing, target, tolerance).length === 0;
