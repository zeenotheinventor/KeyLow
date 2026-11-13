// The kitchen world of the kitchen sets (KEY-1028): six more recipes, the programme targets with a figure for each
// day of the week, and what the planner is given. Everything is synthetic, built from the 13 seeded CoFID foods of
// `diary.ts`, so the numbers are the ones core works out from the seed and nothing here is typed from memory.
//
// With "Eval porridge bowl" and "Eval chicken and rice" of `diary.ts` there are eight recipes, enough for a week
// of meals under a repeat limit of 2: three recipes suit each of the morning, midday and the evening.
import type { FixtureFood, FixtureRecipe } from "./diary.ts";
import type { DayOfWeekKcal } from "@keylow/core/engine";
import type { PlanBand } from "@keylow/core/plans";

export const kitchenRecipes: readonly FixtureRecipe[] = [
  {
    name: "Eval yogurt and apple bowl",
    servings: 1,
    yieldGrams: 390,
    ingredients: [
      { food: "yogurt", grams: 200 },
      { food: "apple", grams: 150 },
      { food: "oats", grams: 40 },
    ],
    steps: ["Spoon the yogurt into a bowl.", "Chop the apple on top.", "Scatter over the oats."],
  },
  {
    name: "Eval egg on toast",
    servings: 1,
    yieldGrams: 205,
    ingredients: [
      { food: "egg", grams: 120 },
      { food: "bread", grams: 80 },
      { food: "oil", grams: 5 },
    ],
    steps: ["Boil the egg.", "Toast the bread and brush it with the oil.", "Serve together."],
  },
  {
    name: "Eval salmon and potato lunch",
    servings: 1,
    yieldGrams: 460,
    ingredients: [
      { food: "salmon", grams: 130 },
      { food: "potato", grams: 250 },
      { food: "broccoli", grams: 80 },
    ],
    steps: ["Grill the salmon.", "Boil the potatoes.", "Steam the broccoli and serve."],
  },
  {
    name: "Eval chicken and egg plate",
    servings: 1,
    yieldGrams: 390,
    ingredients: [
      { food: "chicken", grams: 150 },
      { food: "egg", grams: 100 },
      { food: "bread", grams: 60 },
      { food: "broccoli", grams: 80 },
    ],
    steps: ["Grill the chicken.", "Boil the egg.", "Plate with the bread and the broccoli."],
  },
  {
    name: "Eval chicken and potato bake",
    servings: 2,
    yieldGrams: 1160,
    ingredients: [
      { food: "chicken", grams: 320 },
      { food: "potato", grams: 600 },
      { food: "broccoli", grams: 240 },
      { food: "oil", grams: 16 },
    ],
    steps: ["Roast the chicken and the potatoes.", "Steam the broccoli.", "Combine and serve."],
  },
  {
    name: "Eval salmon and rice bowl",
    servings: 2,
    yieldGrams: 870,
    ingredients: [
      { food: "salmon", grams: 260 },
      { food: "rice", grams: 400 },
      { food: "broccoli", grams: 200 },
      { food: "oil", grams: 10 },
    ],
    steps: ["Grill the salmon.", "Boil the rice.", "Steam the broccoli.", "Build the bowls."],
  },
];

/** The bands each recipe suits, which `planMeals` reads. The two recipes of `diary.ts` are here too. */
export const KITCHEN_RECIPE_BANDS: Readonly<Record<string, readonly PlanBand[]>> = {
  "Eval porridge bowl": ["morning"],
  "Eval chicken and rice": ["midday", "evening"],
  "Eval yogurt and apple bowl": ["morning"],
  "Eval egg on toast": ["morning"],
  "Eval salmon and potato lunch": ["midday"],
  "Eval chicken and egg plate": ["midday"],
  "Eval chicken and potato bake": ["evening"],
  "Eval salmon and rice bowl": ["evening"],
};

type FillerFood = Readonly<{ typicalGrams: number; bands: readonly PlanBand[] }>;

/**
 * The foods the planner may add to close a day, with the grams the eval diary usually logs. Milk is left out,
 * because the diary only has it inside the porridge bowl.
 */
export const KITCHEN_FILLER_FOODS: Readonly<Partial<Record<FixtureFood, FillerFood>>> = {
  oats: { typicalGrams: 30, bands: ["morning"] },
  banana: { typicalGrams: 90, bands: ["morning"] },
  egg: { typicalGrams: 120, bands: ["morning", "midday"] },
  bread: { typicalGrams: 60, bands: ["morning", "midday"] },
  yogurt: { typicalGrams: 150, bands: ["morning"] },
  apple: { typicalGrams: 100, bands: ["morning", "midday"] },
  chicken: { typicalGrams: 130, bands: ["midday", "evening"] },
  rice: { typicalGrams: 180, bands: ["midday", "evening"] },
  broccoli: { typicalGrams: 80, bands: ["midday", "evening"] },
  salmon: { typicalGrams: 120, bands: ["midday", "evening"] },
  potato: { typicalGrams: 200, bands: ["midday", "evening"] },
  oil: { typicalGrams: 10, bands: ["evening"] },
};

/** The calories of each day of the programme's week, Monday first: the proposed board of the plan screen. */
export const KITCHEN_DAY_KCAL: DayOfWeekKcal = [1300, 1300, 1300, 1300, 1300, 1550, 1450];

/**
 * The programme targets row the eval user is given: the week's figure, each day's calories and the macros that are
 * one figure for the week. 90 g protein, 150 g carbs and 50 g fat are the ones of `ASK_TARGETS`.
 */
export const KITCHEN_TARGETS = {
  kcal: Math.round(KITCHEN_DAY_KCAL.reduce((sum, kcal) => sum + kcal, 0) / KITCHEN_DAY_KCAL.length),
  dowKcal: KITCHEN_DAY_KCAL,
  protein_g: 90,
  carbs_g: 150,
  fat_g: 50,
} as const;

/** The limit on how often a recipe appears in a plan, which a person who chose none has (Zee, 2026-11-13). */
export const KITCHEN_REPEAT_LIMIT = 2;
