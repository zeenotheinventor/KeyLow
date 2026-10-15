import { estimateDensity } from "./density";

import type { Food } from "../schemas/food";

export const ML_PER_TSP = 5;
export const ML_PER_TBSP = 15;

const TSP_LABEL = "1 tsp";
const TBSP_LABEL = "1 tbsp";

/**
 * A portion that a function makes rather than a database row, so it has no uuid. It has the shape of a
 * food portion's id, label, grams and ml, and is always in millilitres.
 */
export type SpoonPortion = { id: string; label: string; grams: null; ml: number };

/**
 * The teaspoon and the tablespoon, as portions of any food that can be measured by volume. They are
 * logged with the `portion` unit, so no unit and no snapshot field exists for them.
 */
export const SPOON_PORTIONS: readonly SpoonPortion[] = [
  { id: "spoon-tsp", label: TSP_LABEL, grams: null, ml: ML_PER_TSP },
  { id: "spoon-tbsp", label: TBSP_LABEL, grams: null, ml: ML_PER_TBSP },
];

export const spoonPortionWithLabel = (label: string): SpoonPortion | undefined =>
  SPOON_PORTIONS.find((portion) => portion.label === label);

export const isSpoonPortionId = (id: string): boolean =>
  SPOON_PORTIONS.some((portion) => portion.id === id);

type VolumeFood = Pick<Food, "source" | "source_ref" | "food_group" | "density_g_per_ml">;

/**
 * Whether a food can be logged in millilitres and spoons. A food measured per 100 ml can without a
 * density; any other food needs one, its own or an estimate, because `estimateDensity` returning null
 * is only "no volume measure" for a food that is not already measured per 100 ml.
 */
export const canMeasureByVolume = (food: VolumeFood & Pick<Food, "basis">): boolean =>
  food.basis === "per_100ml" || estimateDensity(food) !== null;

/**
 * The density a log freezes into the snapshot: the food's own, else the estimate, else null. Freezing it
 * is what keeps an entry from changing when the density table is retuned.
 */
export const densityForLogging = (food: VolumeFood): number | null =>
  food.density_g_per_ml ?? estimateDensity(food)?.gPerMl ?? null;
