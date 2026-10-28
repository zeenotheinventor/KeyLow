import { estimateDensity } from "./density";
import { ML_PER_CUP, ML_PER_TBSP, ML_PER_TSP } from "./units";

import type { PortionForDensity } from "./labelDensity";
import type { Food } from "../schemas/food";

export { ML_PER_TBSP, ML_PER_TSP };

const TSP_LABEL = "1 tsp";
const TBSP_LABEL = "1 tbsp";
const CUP_LABEL = "1 cup";

/**
 * A portion that a function makes rather than a database row, so it has no uuid. It has the shape of a
 * food portion's id, label, grams and ml, and is always in millilitres.
 */
export type SpoonPortion = { id: string; label: string; grams: null; ml: number };

/**
 * The generated household measures (the teaspoon, the tablespoon and the cup), as portions of any food that
 * can be measured by volume. They are logged with the `portion` unit, so no unit and no snapshot field
 * exists for them.
 */
export const SPOON_PORTIONS: readonly SpoonPortion[] = [
  { id: "spoon-tsp", label: TSP_LABEL, grams: null, ml: ML_PER_TSP },
  { id: "spoon-tbsp", label: TBSP_LABEL, grams: null, ml: ML_PER_TBSP },
  { id: "spoon-cup", label: CUP_LABEL, grams: null, ml: ML_PER_CUP },
];

export const spoonPortionWithLabel = (label: string): SpoonPortion | undefined =>
  SPOON_PORTIONS.find((portion) => portion.label === label);

/**
 * The generated measure a portion is, if it is one: a millilitre portion with a measure's label and that
 * measure's size. This is the one place that says so, so a logged entry, a row's wording and "log again"
 * cannot disagree. A gram portion that merely shares a measure's label is not one, and neither is one of
 * another size.
 */
export const spoonPortionOf = (portion: {
  label: string;
  ml?: number | null;
}): SpoonPortion | undefined => {
  const spoon = spoonPortionWithLabel(portion.label);

  return spoon !== undefined && portion.ml === spoon.ml ? spoon : undefined;
};

export const isSpoonPortionId = (id: string): boolean =>
  SPOON_PORTIONS.some((portion) => portion.id === id);

type VolumeFood = Pick<Food, "source" | "source_ref" | "food_group" | "density_g_per_ml">;

/**
 * Whether a food can be logged in millilitres and spoons. A food measured per 100 ml can without a
 * density; any other food needs one, its own or an estimate, because `estimateDensity` returning null
 * is only "no volume measure" for a food that is not already measured per 100 ml. `portions` are the
 * food's own: one such as "1 tbsp (15 g)" is a density for a food that has no other (see `estimateDensity`).
 */
export const canMeasureByVolume = (
  food: VolumeFood & Pick<Food, "basis">,
  portions: readonly PortionForDensity[] = [],
): boolean => food.basis === "per_100ml" || estimateDensity(food, portions) !== null;

/**
 * The density a log freezes into the snapshot: the food's own, else the estimate, else null. Freezing it
 * is what keeps an entry from changing when the density table is retuned, or when the food's portions
 * are edited. Pass the same `portions` that `canMeasureByVolume` was given, so the entry agrees with the
 * chips the person chose from.
 */
export const densityForLogging = (
  food: VolumeFood,
  portions: readonly PortionForDensity[] = [],
): number | null => food.density_g_per_ml ?? estimateDensity(food, portions)?.gPerMl ?? null;
