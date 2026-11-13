// The foods, recipes and palate the adjust_recipe tool's tests share. The foods and recipes mirror the eval
// kitchen of `tools/assistant-evals/fixtures/diary.ts` (KEY-1028): "Eval chicken and rice" and "Eval porridge
// bowl", with the CoFID figures of the seed. Nothing in production imports this.
import { buildRecipeIngredient, computeRecipe } from "../../core.ts";
import { getFood, listFoodPortions } from "../../repos.ts";
import { foodRow, writeContext } from "./writeFixtures.ts";

import type { ToolContext, ToolDefinition } from "../tool.ts";
import type { GenerationServices } from "../generate.ts";

const id = (n: number) => `00000000-0000-4000-8000-0000000d${String(n).padStart(4, "0")}`;

export const adjustFoodIds = {
  chicken: id(1),
  rice: id(2),
  broccoli: id(3),
  oil: id(4),
  oats: id(5),
  milk: id(6),
  banana: id(7),
  yogurt: id(8),
  peanutButter: id(9),
};

export const chickenAndRiceId = id(101);
export const porridgeId = id(102);

const cofid = (overrides: Record<string, unknown>) =>
  foodRow({ source: "cofid", owner_id: null, ...overrides });

const adjustFoods = () => [
  cofid({
    id: adjustFoodIds.chicken,
    name: "Chicken, breast, grilled without skin, meat only",
    kcal: 148,
    protein_g: 32,
    fat_g: 2.2,
    carbs_g: 0,
  }),
  cofid({
    id: adjustFoodIds.rice,
    name: "Rice, white, long grain, boiled in unsalted water",
    kcal: 131,
    protein_g: 2.8,
    fat_g: 0.4,
    carbs_g: 31.1,
  }),
  cofid({
    id: adjustFoodIds.broccoli,
    name: "Broccoli, green, boiled in unsalted water",
    kcal: 28,
    protein_g: 3.3,
    fat_g: 0.5,
    carbs_g: 2.8,
  }),
  cofid({
    id: adjustFoodIds.oil,
    name: "Oil, olive",
    kcal: 899,
    protein_g: 0,
    fat_g: 99.9,
    carbs_g: 0,
  }),
  cofid({
    id: adjustFoodIds.oats,
    name: "Porridge oats, unfortified",
    kcal: 381,
    protein_g: 10.9,
    fat_g: 8.1,
    carbs_g: 70.7,
  }),
  cofid({
    id: adjustFoodIds.milk,
    name: "Milk, whole, pasteurised, average",
    kcal: 63,
    protein_g: 3.4,
    fat_g: 3.6,
    carbs_g: 4.6,
  }),
  cofid({
    id: adjustFoodIds.banana,
    name: "Bananas, flesh only",
    kcal: 81,
    protein_g: 1.2,
    fat_g: 0.1,
    carbs_g: 20.3,
  }),
  cofid({
    id: adjustFoodIds.yogurt,
    name: "Yogurt, Greek style, plain",
    kcal: 133,
    protein_g: 5.7,
    fat_g: 10.2,
    carbs_g: 4.8,
  }),
  cofid({
    id: adjustFoodIds.peanutButter,
    name: "Peanut butter, smooth",
    kcal: 623,
    protein_g: 22,
    fat_g: 51,
    carbs_g: 13,
  }),
];

export type RecipeSpec = {
  id: string;
  name: string;
  servings: number;
  steps: string[];
  lines: { foodId: string; grams: number }[];
};

export const chickenAndRice: RecipeSpec = {
  id: chickenAndRiceId,
  name: "Eval chicken and rice",
  servings: 2,
  steps: ["Grill the chicken.", "Boil the rice.", "Steam the broccoli.", "Combine and serve."],
  lines: [
    { foodId: adjustFoodIds.chicken, grams: 260 },
    { foodId: adjustFoodIds.rice, grams: 360 },
    { foodId: adjustFoodIds.broccoli, grams: 160 },
    { foodId: adjustFoodIds.oil, grams: 15 },
  ],
};

export const porridge: RecipeSpec = {
  id: porridgeId,
  name: "Eval porridge bowl",
  servings: 1,
  steps: ["Heat the oats and the milk.", "Stir until thick.", "Slice the banana on top."],
  lines: [
    { foodId: adjustFoodIds.oats, grams: 50 },
    { foodId: adjustFoodIds.milk, grams: 200 },
    { foodId: adjustFoodIds.banana, grams: 90 },
  ],
};

// A stored recipe row as `save_recipe` leaves it: each ingredient frozen from its food, the cache from core.
export async function storedRecipeRow(ctx: ToolContext, spec: RecipeSpec) {
  const ingredients = await Promise.all(
    spec.lines.map(async ({ foodId, grams }) => {
      const food = await getFood(ctx.caller, foodId);
      if (food === null) {
        throw new Error("The fixture food is missing");
      }
      return buildRecipeIngredient(food, {
        quantity: grams,
        unit: "g",
        foodPortions: await listFoodPortions(ctx.caller, foodId),
      });
    }),
  );
  return {
    id: spec.id,
    owner_id: ctx.userId,
    name: spec.name,
    servings: spec.servings,
    yield_grams: null,
    instructions: spec.steps,
    computed: computeRecipe({
      servings: spec.servings,
      yieldGrams: null,
      ingredients,
    }),
    is_archived: false,
    source_url: null,
    recipe_ingredients: ingredients.map((ingredient, position) => ({
      owner_id: ctx.userId,
      ...ingredient,
      position,
    })),
  };
}

const statsOf = (foodId: string, days: number) => ({
  food_id: foodId,
  recipe_id: null,
  entry_count: days,
  distinct_days: days,
  first_local_date: "2026-10-01",
  last_local_date: "2026-11-02",
  median_resolved_grams: 120,
  before_eleven_count: 0,
  eleven_to_sixteen_count: 0,
  sixteen_or_later_count: days,
});

export type AdjustContextOptions = {
  generation?: GenerationServices;
  /** The foods eaten on most days, most often first. */
  usualFoods?: string[];
  preferences?: Record<string, unknown>[];
  withRecipes?: RecipeSpec[];
};

export async function adjustContext(
  tools: readonly ToolDefinition[],
  options: AdjustContextOptions = {},
) {
  const usual = options.usualFoods ?? [adjustFoodIds.chicken, adjustFoodIds.yogurt];
  const made = writeContext(tools, {
    rows: {
      foods: adjustFoods(),
      food_portions: [],
      recipes: [],
      palate_logged_days: [{ logged_days: 10 }],
      palate_food_stats: usual.map((foodId, index) => statsOf(foodId, 8 - index)),
      palate_preferences: options.preferences ?? [],
    },
  });
  const recipes = made.stub.tables["recipes"] ?? [];
  for (const spec of options.withRecipes ?? [chickenAndRice, porridge]) {
    recipes.push(await storedRecipeRow(made.ctx, spec));
  }
  made.stub.tables["recipes"] = recipes;
  const ctx: ToolContext = {
    ...made.ctx,
    ...(options.generation === undefined ? {} : { generation: options.generation }),
  };
  return { ...made, ctx };
}
