import { MEAL_PLAN_BANDS } from "./constants";
import { avoidsFood } from "../palate/avoidsFood";

import type { PlanBand, PlanFoodCandidate, PlanRecipeCandidate } from "./types";
import type { PalateFoodStat, PalatePreference } from "../palate/types";
import type { Recipe, RecipeComputed } from "../recipes/schemas";
import type { Food } from "../schemas/food";

/** The most a plan offers the model and the planner, so the ranking call and the planner's work stay small. */
export const PLAN_POOL_LIMITS = { recipes: 30, foods: 20 } as const;

/** The amount a usual food gets when the diary has no typical amount for it. */
export const PLAN_DEFAULT_FOOD_GRAMS = 100;

export type PlanPoolRecipe = Pick<Recipe, "name" | "servings"> & {
  id: string;
  computed: Pick<RecipeComputed, "perServing">;
};

export type PlanPoolFood = Pick<
  Food,
  "id" | "name" | "basis" | "kcal" | "protein_g" | "fat_g" | "carbs_g" | "fibre_g"
>;

export type PlanPoolInput = {
  /** The person's live recipes. */
  recipes: readonly PlanPoolRecipe[];
  /** The ids of the recipes the diary shows are usual, most usual first. They are offered before the rest. */
  usualRecipeIds: readonly string[];
  /** The foods the person usually logs, most usual first, with the grams they usually have. */
  usualFoods: readonly { foodId: string; typicalGrams: number | null }[];
  /** The rows of the usual foods. A food with no row here, or not per 100 g, is not planned. */
  foods: readonly PlanPoolFood[];
  /** What the diary says of each food and recipe, for the time of day it is eaten at. */
  stats: readonly PalateFoodStat[];
  preferences: readonly PalatePreference[];
};

/** One recipe or food as the model is shown it: a short code, which is all it may answer with, and a name. */
export type PlanOffer = { code: string; id: string; name: string; kind: "recipe" | "food" };

export type PlanPoolResult = {
  recipes: PlanRecipeCandidate[];
  foods: PlanFoodCandidate[];
  /** Recipes then foods, in the order they are offered. */
  offers: PlanOffer[];
};

const bandsOf = (stat: PalateFoodStat | undefined): PlanBand[] => {
  if (stat === undefined) {
    return [...MEAL_PLAN_BANDS];
  }
  const counts: Record<PlanBand, number> = {
    morning: stat.beforeElevenCount,
    midday: stat.elevenToSixteenCount,
    evening: stat.sixteenOrLaterCount,
  };
  const eaten = MEAL_PLAN_BANDS.filter((band) => counts[band] > 0);
  return eaten.length === 0 ? [...MEAL_PLAN_BANDS] : eaten;
};

/**
 * What a plan is made from. The recipes are the person's live ones with a calorie figure, the usual ones first.
 * The foods are the ones the person usually logs, counted per 100 g. Anything the person avoids is left out by
 * name, before the model sees a name. A band is one the diary shows the item eaten in, and all three when the
 * diary says nothing.
 */
export const buildPlanPool = (input: PlanPoolInput): PlanPoolResult => {
  const statOf = new Map<string, PalateFoodStat>();
  for (const stat of input.stats) {
    const id = stat.foodId ?? stat.recipeId;
    if (id !== null) {
      statOf.set(id, stat);
    }
  }
  const isAvoided = (item: { id: string; name: string }): boolean =>
    avoidsFood(item, input.preferences).avoid;

  const recipeById = new Map(input.recipes.map((recipe) => [recipe.id, recipe]));
  const usualRecipes = input.usualRecipeIds.flatMap((id) => recipeById.get(id) ?? []);
  const usualIds = new Set(usualRecipes.map(({ id }) => id));
  const usualFirst = [...usualRecipes, ...input.recipes.filter(({ id }) => !usualIds.has(id))];
  const recipeRows = usualFirst
    .filter((recipe) => recipe.computed.perServing.kcal !== null && !isAvoided(recipe))
    .slice(0, PLAN_POOL_LIMITS.recipes);

  const foodById = new Map(input.foods.map((food) => [food.id, food]));
  const foodRows = input.usualFoods
    .flatMap(({ foodId, typicalGrams }) => {
      const food = foodById.get(foodId);
      return food === undefined || food.basis !== "per_100g" || isAvoided(food)
        ? []
        : [{ food, typicalGrams }];
    })
    .slice(0, PLAN_POOL_LIMITS.foods);

  const recipes = recipeRows.map((recipe): PlanRecipeCandidate => ({
    id: recipe.id,
    perServing: recipe.computed.perServing,
    servings: recipe.servings,
    bands: bandsOf(statOf.get(recipe.id)),
  }));
  const foods = foodRows.map(({ food, typicalGrams }): PlanFoodCandidate => ({
    id: food.id,
    per100: {
      kcal: food.kcal,
      protein_g: food.protein_g,
      fat_g: food.fat_g,
      carbs_g: food.carbs_g,
      fibre_g: food.fibre_g,
    },
    typicalGrams: typicalGrams ?? PLAN_DEFAULT_FOOD_GRAMS,
    bands: bandsOf(statOf.get(food.id)),
  }));
  const offers: PlanOffer[] = [
    ...recipeRows.map(({ id, name }, at): PlanOffer => ({
      code: `r${at + 1}`,
      id,
      name,
      kind: "recipe",
    })),
    ...foodRows.map(({ food }, at): PlanOffer => ({
      code: `f${at + 1}`,
      id: food.id,
      name: food.name,
      kind: "food",
    })),
  ];
  return { recipes, foods, offers };
};
