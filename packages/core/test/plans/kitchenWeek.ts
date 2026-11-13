import { EVAL_FOODS } from "./evalKitchen";
import { addCalendarDays, daysSinceMonday } from "../../src/dates/calendarDay";
import { fitRecipeToTargets } from "../../src/recipes";

import type { PlanMealsInput, PlanRecipeCandidate } from "../../src/plans";
import type { FitIngredient } from "../../src/recipes";

// The kitchen world of the kitchen eval sets (tools/assistant-evals/fixtures/kitchen.ts, KEY-1028): eight recipes,
// the twelve filler foods of `evalKitchen.ts`, and the programme's calories for each weekday. Copied here, with the
// foods' per 100 g figures, so core tests do not import across packages. Everything is synthetic.
const FOODS = new Map(EVAL_FOODS.map((food) => [food.id, food.per100]));
const MILK = { kcal: 63, protein_g: 3.4, fat_g: 3.6, carbs_g: 4.6, fibre_g: 0 };

type KitchenRecipe = {
  name: string;
  servings: number;
  bands: PlanRecipeCandidate["bands"];
  ingredients: readonly (readonly [string, number])[];
};

const RECIPES: readonly KitchenRecipe[] = [
  {
    name: "Eval porridge bowl",
    servings: 1,
    bands: ["morning"],
    ingredients: [
      ["oats", 50],
      ["milk", 200],
      ["banana", 90],
    ],
  },
  {
    name: "Eval chicken and rice",
    servings: 2,
    bands: ["midday", "evening"],
    ingredients: [
      ["chicken", 260],
      ["rice", 360],
      ["broccoli", 160],
      ["oil", 15],
    ],
  },
  {
    name: "Eval yogurt and apple bowl",
    servings: 1,
    bands: ["morning"],
    ingredients: [
      ["yogurt", 200],
      ["apple", 150],
      ["oats", 40],
    ],
  },
  {
    name: "Eval egg on toast",
    servings: 1,
    bands: ["morning"],
    ingredients: [
      ["egg", 120],
      ["bread", 80],
      ["oil", 5],
    ],
  },
  {
    name: "Eval salmon and potato lunch",
    servings: 1,
    bands: ["midday"],
    ingredients: [
      ["salmon", 130],
      ["potato", 250],
      ["broccoli", 80],
    ],
  },
  {
    name: "Eval chicken and egg plate",
    servings: 1,
    bands: ["midday"],
    ingredients: [
      ["chicken", 150],
      ["egg", 100],
      ["bread", 60],
      ["broccoli", 80],
    ],
  },
  {
    name: "Eval chicken and potato bake",
    servings: 2,
    bands: ["evening"],
    ingredients: [
      ["chicken", 320],
      ["potato", 600],
      ["broccoli", 240],
      ["oil", 16],
    ],
  },
  {
    name: "Eval salmon and rice bowl",
    servings: 2,
    bands: ["evening"],
    ingredients: [
      ["salmon", 260],
      ["rice", 400],
      ["broccoli", 200],
      ["oil", 10],
    ],
  },
];

const per100Of = (food: string) => {
  const per100 = food === "milk" ? MILK : FOODS.get(food);
  if (per100 === undefined) {
    throw new Error("unknown fixture food");
  }
  return per100;
};

export const KITCHEN_RECIPES: readonly PlanRecipeCandidate[] = RECIPES.map(
  ({ name, servings, bands, ingredients }) => {
    const fitIngredients: FitIngredient[] = ingredients.map(([food, grams]) => ({
      foodId: food,
      per100: per100Of(food),
      grams,
      locked: false,
    }));
    return {
      id: name,
      perServing: fitRecipeToTargets({ ingredients: fitIngredients, servings, target: {} })
        .perServing,
      servings,
      bands,
    };
  },
);

const DAY_KCAL = [1300, 1300, 1300, 1300, 1300, 1550, 1450];

/** Seven days from `firstLocalDate`, each with its weekday's calories (Monday first) and 90 g of protein. */
export const kitchenWeekFrom = (firstLocalDate: string) =>
  Array.from({ length: 7 }, (_, offset) => {
    const localDate = addCalendarDays(firstLocalDate, offset);
    return {
      localDate,
      target: { kcal: DAY_KCAL[daysSinceMonday(localDate)] ?? 1300, protein_g: 90 },
    };
  });

export const KITCHEN_START_DATES = Array.from({ length: 7 }, (_, offset) =>
  addCalendarDays("2026-11-16", offset),
);

const proteinOrder = (): string[] =>
  [...KITCHEN_RECIPES]
    .sort((a, b) => (b.perServing.protein_g ?? 0) - (a.perServing.protein_g ?? 0))
    .map(({ id }) => id);

export const KITCHEN_RANKINGS: Readonly<Record<string, readonly string[]>> = {
  "no ranking": [],
  "a protein ranking": proteinOrder(),
  "a reverse ranking": KITCHEN_RECIPES.map(({ id }) => id).reverse(),
};

export const kitchenInput = (
  firstLocalDate: string,
  ranking: readonly string[],
): PlanMealsInput => ({
  recipes: KITCHEN_RECIPES,
  foods: EVAL_FOODS,
  ranking,
  rules: { maxRepeats: 2, leftovers: true, slots: ["morning", "midday", "evening"] },
  days: kitchenWeekFrom(firstLocalDate),
});
