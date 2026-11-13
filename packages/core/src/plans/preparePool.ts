import { MEAL_PLAN_BANDS, MEAL_PLAN_MAX_REPEAT_LIMIT } from "./constants";

import type { PlanBand, PlanFoodCandidate, PlanPool, PlanRecipeCandidate } from "./types";
import type { NullableNutrients } from "../schemas/nutrients";

export type RecipeChoice = {
  kind: "recipe";
  id: string;
  perServing: PlanRecipeCandidate["perServing"];
  servings: number;
  /** The candidate's bands that are being planned. */
  bands: PlanBand[];
  /** Where it stands in the preference order. Lower is preferred. */
  order: number;
};

export type FoodChoice = {
  kind: "food";
  id: string;
  per100: PlanFoodCandidate["per100"];
  typicalGrams: number;
  bands: PlanBand[];
  order: number;
};

export type PreparedPool = {
  recipes: RecipeChoice[];
  foods: FoodChoice[];
  /** `Infinity` when the person set no limit. */
  limit: number;
  leftovers: boolean;
  /** The planned bands, in day order, each once. */
  slots: PlanBand[];
};

const isBand = (value: unknown): value is PlanBand =>
  MEAL_PLAN_BANDS.some((band) => band === value);

/** Every figure is unknown (null) or a finite number of at least 0. */
const hasSaneFigures = (nutrients: NullableNutrients): boolean =>
  [
    nutrients.kcal,
    nutrients.protein_g,
    nutrients.fat_g,
    nutrients.carbs_g,
    nutrients.fibre_g,
  ].every((figure) => figure === null || (Number.isFinite(figure) && figure >= 0));

const isPositive = (value: number): boolean => Number.isFinite(value) && value > 0;

/**
 * The ids of the ranking that name a candidate, most preferred first, each once. Anything else in a ranking
 * (an id nobody offered, a repeat, a value that is not a string) is dropped, so a ranking can only reorder.
 */
const rankedIds = (ranking: unknown, known: ReadonlySet<string>): string[] => {
  const seen = new Set<string>();
  const entries: unknown[] = Array.isArray(ranking) ? ranking : [];
  for (const entry of entries) {
    if (typeof entry === "string" && known.has(entry)) {
      seen.add(entry);
    }
  }
  return [...seen];
};

/**
 * Checks the rules, drops the candidates that cannot be placed (no calorie figure, no bands among those
 * planned, an amount that is not above 0, a repeated id) and orders the rest by the ranking, then by the order
 * they were given. Throws a `RangeError` for rules that cannot be planned.
 */
export const preparePool = (pool: PlanPool): PreparedPool => {
  const { maxRepeats, leftovers, slots: requested } = pool.rules;
  if (
    maxRepeats !== null &&
    (!Number.isInteger(maxRepeats) || maxRepeats < 1 || maxRepeats > MEAL_PLAN_MAX_REPEAT_LIMIT)
  ) {
    throw new RangeError("The repeat limit must be null or a whole number from 1 to 7");
  }
  if (requested.length === 0 || !requested.every(isBand)) {
    throw new RangeError("A plan needs at least one band, each morning, midday or evening");
  }
  const slots = MEAL_PLAN_BANDS.filter((band) => requested.includes(band));
  const usableBands = (bands: readonly PlanBand[]): PlanBand[] =>
    slots.filter((band) => bands.includes(band));

  const seenIds = new Set<string>();
  const isNew = (id: string): boolean => {
    const isUnseen = !seenIds.has(id);
    seenIds.add(id);
    return isUnseen;
  };

  const recipes = pool.recipes.filter(
    (recipe) =>
      recipe.perServing.kcal !== null &&
      hasSaneFigures(recipe.perServing) &&
      isPositive(recipe.servings) &&
      usableBands(recipe.bands).length > 0 &&
      isNew(recipe.id),
  );
  const foods = pool.foods.filter(
    (food) =>
      food.per100.kcal !== null &&
      hasSaneFigures(food.per100) &&
      isPositive(food.typicalGrams) &&
      usableBands(food.bands).length > 0 &&
      isNew(food.id),
  );

  const ranked = rankedIds(pool.ranking, new Set([...recipes, ...foods].map(({ id }) => id)));
  const orderOf = (id: string, givenAt: number): number => {
    const rankAt = ranked.indexOf(id);
    return rankAt === -1 ? ranked.length + givenAt : rankAt;
  };

  return {
    recipes: recipes.map((recipe, at) => ({
      kind: "recipe",
      id: recipe.id,
      perServing: recipe.perServing,
      servings: recipe.servings,
      bands: usableBands(recipe.bands),
      order: orderOf(recipe.id, at),
    })),
    foods: foods.map((food, at) => ({
      kind: "food",
      id: food.id,
      per100: food.per100,
      typicalGrams: food.typicalGrams,
      bands: usableBands(food.bands),
      order: orderOf(food.id, recipes.length + at),
    })),
    limit: maxRepeats ?? Number.POSITIVE_INFINITY,
    leftovers,
    slots,
  };
};
