import { fitRecipeToTargets } from "../../src/recipes";
import { CHICKEN_AND_RICE, PORRIDGE_BOWL } from "../recipes/fit/seedRecipes";

import type { PlanBand, PlanFoodCandidate, PlanRecipeCandidate } from "../../src/plans";

// The eval user's kitchen (tools/assistant-evals/fixtures/diary.ts): its two recipes, and its foods with the
// per 100 g figures of the CoFID rows (packages/db/data/cofid/subset.txt) and the grams it usually logs.
// Everything here is synthetic. Ids are the fixture's food names.
const per = (kcal: number, protein_g: number, fat_g: number, carbs_g: number, fibre_g: number) => ({
  kcal,
  protein_g,
  fat_g,
  carbs_g,
  fibre_g,
});

const food = (
  id: string,
  per100: PlanFoodCandidate["per100"],
  typicalGrams: number,
  bands: readonly PlanBand[],
): PlanFoodCandidate => ({ id, per100, typicalGrams, bands });

export const EVAL_FOODS: readonly PlanFoodCandidate[] = [
  food("oats", per(381, 10.9, 8.1, 70.7, 7.8), 30, ["morning"]),
  food("banana", per(81, 1.2, 0.1, 20.3, 1.4), 90, ["morning"]),
  food("egg", per(143, 14.1, 9.6, 0, 0), 120, ["morning", "midday"]),
  food("bread", per(207, 7.9, 2, 42.1, 5), 60, ["morning", "midday"]),
  food("yogurt", per(133, 5.7, 10.2, 4.8, 0), 150, ["morning"]),
  food("apple", per(51, 0.6, 0.5, 11.6, 1.2), 100, ["morning", "midday"]),
  food("chicken", per(148, 32, 2.2, 0, 0), 130, ["midday", "evening"]),
  food("rice", per(131, 2.8, 0.4, 31.1, 0.5), 180, ["midday", "evening"]),
  food("broccoli", per(28, 3.3, 0.5, 2.8, 2.8), 80, ["midday", "evening"]),
  food("salmon", per(239, 24.6, 15.6, 0, 0), 120, ["midday", "evening"]),
  food("potato", per(74, 1.8, 0.1, 17.5, 1.6), 200, ["midday", "evening"]),
  food("oil", per(899, 0, 99.9, 0, 0), 10, ["evening"]),
];

const perServingOf = (recipe: typeof PORRIDGE_BOWL) =>
  fitRecipeToTargets({ ...recipe, target: {} }).perServing;

export const EVAL_RECIPES: readonly PlanRecipeCandidate[] = [
  {
    id: "porridge-bowl",
    perServing: perServingOf(PORRIDGE_BOWL),
    servings: PORRIDGE_BOWL.servings,
    bands: ["morning"],
  },
  {
    id: "chicken-and-rice",
    perServing: perServingOf(CHICKEN_AND_RICE),
    servings: CHICKEN_AND_RICE.servings,
    bands: ["midday", "evening"],
  },
];

/** Mon 16 to Sun 22 Nov 2026 as the board draws it: 1,300 kcal Monday to Friday, 1,550 Saturday, 1,450 Sunday. */
export const EVAL_WEEK = [1300, 1300, 1300, 1300, 1300, 1550, 1450].map((kcal, index) => ({
  localDate: `2026-11-${16 + index}`,
  target: { kcal, protein_g: 90 },
}));

/** The order the eval user's usual habits suggest, recipes first. */
export const EVAL_RANKING = [
  "porridge-bowl",
  "chicken-and-rice",
  "yogurt",
  "apple",
  "oats",
  "chicken",
  "rice",
  "broccoli",
  "salmon",
  "potato",
  "egg",
  "bread",
  "banana",
  "oil",
];
