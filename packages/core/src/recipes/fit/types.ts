import type { NullableNutrients } from "../../schemas/nutrients";

/** The four nutrients a person can ask a recipe to hit. Fibre and the optional ones are never targeted. */
export type FitNutrient = "kcal" | "protein_g" | "carbs_g" | "fat_g";

/** What the fitter aims for, per serving. A nutrient that is left out is not judged. */
export type FitTarget = {
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
};

/** How far from a target still counts as hitting it. See `FIT_TOLERANCE`. */
export type FitTolerance = {
  kcalPercent: number;
  proteinGrams: number;
  macroGrams: number;
};

export type FitIngredient = {
  foodId: string;
  per100: NullableNutrients;
  /** The proposed amount. Must be above 0. */
  grams: number;
  /** A locked ingredient never changes. */
  locked: boolean;
  /** Replaces the lower edge of the default band (half the proposed grams, at least 5 g). 0 lets the ingredient drop to 0 g. That is for the planner, which uses it to leave a food out of a day. A recipe caller must not forward a person's 0. */
  minGrams?: number;
  /** Replaces the upper edge of the default band (double the proposed grams, at most 1,000 g). */
  maxGrams?: number;
};

export type FitInput = {
  ingredients: readonly FitIngredient[];
  servings: number;
  target: FitTarget;
  tolerance?: FitTolerance;
};

/**
 * Why a nutrient is out of tolerance in an unreachable result:
 * `no_adjustable_ingredient`: every ingredient that carries the nutrient is locked.
 * `ingredient_bounds`: every adjustable ingredient that carries it is at the edge of its band.
 * `targets_conflict`: moving the ingredients further would spoil another named target.
 * `no_data`: no ingredient has a figure for the nutrient (`achieved` is null), so nothing can be said about it.
 */
export type FitMissReason =
  "no_adjustable_ingredient" | "ingredient_bounds" | "targets_conflict" | "no_data";

export type FitMiss = {
  nutrient: FitNutrient;
  target: number;
  /** Null only for `no_data`. */
  achieved: number | null;
  reason: FitMissReason;
  /** The adjustable ingredients that sit at the edge of their band and so hold the nutrient back. */
  limitedBy: string[];
};

export type FitResult = {
  status: "within" | "unreachable";
  /** For `unreachable` these are the closest amounts found, never a claim that the target is met. */
  ingredients: { foodId: string; grams: number }[];
  /** Core's own `computeRecipe` figures for `ingredients`. */
  perServing: NullableNutrients;
  /** Empty when `within`. */
  misses: FitMiss[];
};
