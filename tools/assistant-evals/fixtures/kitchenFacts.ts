// What the kitchen world adds up to, worked out with core: the recipes' nutrition (`computeRecipe`), the fit of a
// recipe to a target (`fitRecipeToTargets`) and a week plan (`planMeals`). A kitchen case grades against these,
// and an expected figure is never typed by hand, so a change to a recipe cannot leave a stale one.
import { addCalendarDays } from "@keylow/core/dates";
import { dayTarget } from "@keylow/core/engine";
import { planMeals } from "@keylow/core/plans";
import {
  adjustmentTarget,
  buildRecipeIngredient,
  computeRecipe,
  fitRecipeToTargets,
} from "@keylow/core/recipes";

import { FIXTURE_FOODS, fixtureRecipes } from "./diary.ts";
import { FIXTURE_FOOD_VALUES, seededFoods } from "./diaryTotals.ts";
import {
  KITCHEN_DAY_KCAL,
  KITCHEN_FILLER_FOODS,
  KITCHEN_RECIPE_BANDS,
  KITCHEN_REPEAT_LIMIT,
  KITCHEN_TARGETS,
  kitchenRecipes,
} from "./kitchen.ts";
import { present } from "./present.ts";

import type { FixtureFood, FixtureRecipe } from "./diary.ts";
import type { PlanFoodCandidate, PlanRecipeCandidate, PlannedWeek } from "@keylow/core/plans";
import type { FitIngredient, FitResult } from "@keylow/core/recipes";
import type { NullableNutrients } from "@keylow/core/schemas";

/** Every recipe of the kitchen world: the two of `diary.ts` first, then the six of `kitchen.ts`. */
export const allKitchenRecipes: readonly FixtureRecipe[] = [...fixtureRecipes, ...kitchenRecipes];

const recipeNamed = (name: string): FixtureRecipe =>
  present(
    allKitchenRecipes.find((recipe) => recipe.name === name),
    name,
  );

/** What 100 g of a fixture food holds, as the fitter and the planner take it. */
export const per100Of = (food: FixtureFood): NullableNutrients => {
  const { kcal, protein_g, fat_g, carbs_g, fibre_g } = FIXTURE_FOOD_VALUES[food];
  return { kcal, protein_g, fat_g, carbs_g, fibre_g };
};

/** The ingredients of a recipe as the fitter takes them, at the grams the fixture gives. None is locked. */
export const fitIngredientsOf = (recipe: FixtureRecipe): FitIngredient[] =>
  recipe.ingredients.map(({ food, grams }) => ({
    foodId: food,
    per100: per100Of(food),
    grams,
    locked: false,
  }));

/** What one serving of a recipe holds, as `createRecipe` caches it (`computeRecipe` over the built ingredients). */
export function perServingOf(name: string): NullableNutrients {
  const { servings, yieldGrams, ingredients } = recipeNamed(name);
  const foods = seededFoods();
  return computeRecipe({
    servings,
    yieldGrams,
    ingredients: ingredients.map(({ food, grams }) =>
      buildRecipeIngredient(present(foods.get(food), food), { quantity: grams, unit: "g" }),
    ),
  }).perServing;
}

/**
 * A recipe made from the seeded foods that reaches a target. The start is a chicken, rice, broccoli and olive oil
 * plate of the amounts the plan of KEY-216 works out by hand (120 g, 250 g, 100 g and 12 g), one serving.
 */
export function fitFromSeededFoods(target: { kcal: number; protein_g: number }): FitResult {
  const start: readonly [FixtureFood, number][] = [
    ["chicken", 120],
    ["rice", 250],
    ["broccoli", 100],
    ["oil", 12],
  ];
  return fitRecipeToTargets({
    ingredients: start.map(([food, grams]) => ({
      foodId: food,
      per100: per100Of(food),
      grams,
      locked: false,
    })),
    servings: 1,
    target,
  });
}

/** What "make Eval chicken and rice 30 g higher in protein" asks the fitter for, and what it answers. */
export function fitHigherProtein(
  name: string,
  extraProteinGrams: number,
): {
  before: NullableNutrients;
  target: ReturnType<typeof adjustmentTarget>;
  result: FitResult;
} {
  const recipe = recipeNamed(name);
  const before = perServingOf(name);
  const target = adjustmentTarget(before, {
    nutrient: "protein_g",
    mode: "add",
    value: extraProteinGrams,
  });
  return {
    before,
    target,
    result: fitRecipeToTargets({
      ingredients: fitIngredientsOf(recipe),
      servings: recipe.servings,
      target,
    }),
  };
}

/** The recipes the planner may place, with what one serving holds and the bands each suits. */
export const planRecipeCandidates = (): PlanRecipeCandidate[] =>
  allKitchenRecipes.map(({ name, servings }) => ({
    id: name,
    perServing: perServingOf(name),
    servings,
    bands: present(KITCHEN_RECIPE_BANDS[name], name),
  }));

/** The foods the planner may add to close a day. */
export const planFoodCandidates = (): PlanFoodCandidate[] =>
  FIXTURE_FOODS.flatMap((food) => {
    const filler = KITCHEN_FILLER_FOODS[food];
    return filler === undefined ? [] : [{ id: food, per100: per100Of(food), ...filler }];
  });

/**
 * The seven days from `firstLocalDate`, each with the calories core's `dayTarget` gives its weekday and the 90 g
 * of protein of the targets row. Only calories and protein are targeted, as the plan screen's fit does.
 */
export const kitchenWeek = (firstLocalDate: string) =>
  Array.from({ length: KITCHEN_DAY_KCAL.length }, (_, offset) => {
    const localDate = addCalendarDays(firstLocalDate, offset);
    return {
      localDate,
      target: {
        kcal: dayTarget(
          { caloriesKcal: KITCHEN_TARGETS.kcal, dowCaloriesKcal: KITCHEN_DAY_KCAL },
          localDate,
        ),
        protein_g: KITCHEN_TARGETS.protein_g,
      },
    };
  });

/**
 * The recipe names, the one with the most protein in a serving first: the order a person with a protein target is
 * offered them in. The planner is greedy, so the ranking decides which weeks land within tolerance. This one does for
 * a week that starts on a Monday, and on a Wednesday (`test/kitchenFixtures.test.ts` pins both).
 */
export const proteinRanking = (): string[] =>
  allKitchenRecipes
    .map(({ name }) => ({ name, protein: perServingOf(name).protein_g ?? 0 }))
    .sort((left, right) => right.protein - left.protein)
    .map(({ name }) => name);

/** The plan of a week from `firstLocalDate` out of the kitchen recipes and foods, under the repeat limit of 2. */
export const kitchenPlan = (firstLocalDate: string): PlannedWeek =>
  planMeals({
    recipes: planRecipeCandidates(),
    foods: planFoodCandidates(),
    ranking: proteinRanking(),
    rules: {
      maxRepeats: KITCHEN_REPEAT_LIMIT,
      leftovers: true,
      slots: ["morning", "midday", "evening"],
    },
    days: kitchenWeek(firstLocalDate),
  });
