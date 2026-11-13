import { FIT_NUTRIENTS, toleranceOf } from "../recipes/fit";

import type { FitNutrient, FitTarget } from "../recipes/fit";

const SLACK = 1e-6;

/** What a candidate food can add to a day, at its upper bound, for each nutrient. */
export type FoodGain = Readonly<Record<FitNutrient, number>>;

type Axis = readonly [number, number];

/**
 * Whether foods could, in principle, bring a day to its targets, given what the locked recipes already hold
 * (`locked`) and what each candidate food can add at its upper bound (`gains`, each food from 0 g up to that).
 * Cheap, no fit, and a necessary condition only: when it says no, no amounts of these foods fit.
 *
 * Each named nutrient on its own must be reachable, between the locked amount and the locked amount plus every
 * gain, within its tolerance. When calories and protein are both named they must also be reachable together:
 * the foods' amounts make a zonotope in those two, and it is tested against the tolerance box on the two axes
 * of the box and on the normal of every food's own direction, the only axes that can separate two such
 * shapes. The cap on foods in a day and carbs or fat together are ignored, so a yes is not a promise.
 */
export const canReach = (
  target: FitTarget,
  locked: Readonly<Record<FitNutrient, number>>,
  gains: readonly FoodGain[],
): boolean => {
  for (const nutrient of FIT_NUTRIENTS) {
    const wanted = target[nutrient];
    if (wanted === undefined) {
      continue;
    }
    const slack = toleranceOf(nutrient, wanted) + SLACK;
    const least = locked[nutrient];
    const most = least + gains.reduce((sum, gain) => sum + gain[nutrient], 0);
    if (most < wanted - slack || least > wanted + slack) {
      return false;
    }
  }
  const { kcal, protein_g } = target;
  if (kcal === undefined || protein_g === undefined) {
    return true;
  }
  const centre: Axis = [kcal - locked.kcal, protein_g - locked.protein_g];
  const half: Axis = [
    toleranceOf("kcal", kcal) + SLACK,
    toleranceOf("protein_g", protein_g) + SLACK,
  ];
  const generators: Axis[] = gains.map((gain) => [gain.kcal, gain.protein_g]);
  const normals: Axis[] = [
    [1, 0],
    [0, 1],
    ...generators.map(([kcalGain, proteinGain]): Axis => [-proteinGain, kcalGain]),
  ];
  return !normals.some(([nx, ny]) => {
    const along = ([x, y]: Axis): number => nx * x + ny * y;
    const smallest = generators.reduce((sum, generator) => sum + Math.min(0, along(generator)), 0);
    const largest = generators.reduce((sum, generator) => sum + Math.max(0, along(generator)), 0);
    const middle = along(centre);
    const reach = Math.abs(nx) * half[0] + Math.abs(ny) * half[1];
    return middle - reach > largest + SLACK || middle + reach < smallest - SLACK;
  });
};
