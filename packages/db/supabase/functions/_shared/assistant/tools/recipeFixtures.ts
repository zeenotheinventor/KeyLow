// The recipes, foods and context the recipe write tools' tests share. Nothing in production imports this.
import { userId } from "../testing.ts";
import { dietRows, foodRow, portionRow, writeContext } from "./writeFixtures.ts";

import type { RpcHandler } from "./writeStub.ts";
import type { ToolDefinition } from "../tool.ts";

export const chickenId = "00000000-0000-4000-8000-0000000000c1";
export const riceId = "00000000-0000-4000-8000-0000000000c2";
export const oliveOilId = "00000000-0000-4000-8000-0000000000c3";
export const tablespoonId = "00000000-0000-4000-8000-0000000000c4";
export const otherUserId = "00000000-0000-4000-8000-0000000000b2";

// The figures are per 100 g, chosen so the board's Chicken and rice (500 g chicken breast, 400 g white rice
// and 2 tbsp olive oil, 4 servings) is 550 kcal, P 37 g, C 79 g and F 8.6 g a serving.
const recipeFoods = () => ({
  foods: [
    foodRow({
      id: chickenId,
      name: "Chicken breast, raw",
      kcal: 106,
      protein_g: 22.6,
      fat_g: 1,
      carbs_g: 0,
    }),
    foodRow({
      id: riceId,
      name: "White rice, dry",
      kcal: 357,
      protein_g: 8.8,
      fat_g: 0.6,
      carbs_g: 78.9,
    }),
    foodRow({
      id: oliveOilId,
      name: "Olive oil",
      kcal: 900,
      protein_g: 0,
      fat_g: 100,
      carbs_g: 0,
      density_g_per_ml: 0.9,
    }),
  ],
  food_portions: [portionRow(tablespoonId, oliveOilId, "tbsp", 13.5)],
});

// The board's ingredients, as the model sends them.
export const chickenAndRiceIngredients = [
  { food_id: chickenId, unit: "g", amount: 500, portion_id: null },
  { food_id: riceId, unit: "g", amount: 400, portion_id: null },
  { food_id: oliveOilId, unit: "portion", amount: 2, portion_id: tablespoonId },
];

export const chickenAndRice = {
  name: "Chicken and rice",
  servings: 4,
  ingredients: chickenAndRiceIngredients,
  steps: ["Cook the rice.", "Fry the chicken in the oil.", "Mix and serve."],
  source_url: null,
};

let nextRecipe = 1;

// `save_recipe` as the database answers it: the recipe and its ingredients are kept together, a new recipe
// is the caller's and is not archived, and a recipe that is not the caller's is not found.
export const saveRecipeRpc: RpcHandler = (args, tables) => {
  const recipe = args["p_recipe"] as Record<string, unknown>;
  const ingredients = args["p_ingredients"] as Record<string, unknown>[];
  const rows = (tables["recipes"] ??= []);
  const fields = {
    name: recipe["name"],
    servings: recipe["servings"],
    yield_grams: recipe["yield_grams"] ?? null,
    instructions: recipe["instructions"],
    computed: recipe["computed"],
    recipe_ingredients: ingredients.map((ingredient, position) => ({
      owner_id: userId,
      ...ingredient,
      position,
    })),
  };
  const existingId = args["p_recipe_id"];
  if (existingId === null || existingId === undefined) {
    const id = `00000000-0000-4000-8000-0000000e${String(nextRecipe++).padStart(4, "0")}`;
    rows.push({
      id,
      owner_id: userId,
      is_archived: false,
      source_url: recipe["source_url"] ?? null,
      ...fields,
    });
    return { data: id, error: null };
  }
  const existing = rows.find((row) => row["id"] === existingId && row["owner_id"] === userId);
  if (existing === undefined) {
    return { data: null, error: { code: "P0002", message: "not found" } };
  }
  // A save without the key keeps the stored link, as the database does.
  Object.assign(
    existing,
    fields,
    "source_url" in recipe ? { source_url: recipe["source_url"] } : {},
  );
  return { data: existingId, error: null };
};

export const recipeRow = (overrides: Record<string, unknown> = {}) => ({
  id: "00000000-0000-4000-8000-0000000e9001",
  owner_id: userId,
  name: "Pasta bake",
  servings: 4,
  yield_grams: null,
  instructions: [],
  computed: {
    total: { kcal: 2000, protein_g: 80, fat_g: 60, carbs_g: 260, fibre_g: null },
    perServing: { kcal: 500, protein_g: 20, fat_g: 15, carbs_g: 65, fibre_g: null },
    per100g: { kcal: 100, protein_g: 4, fat_g: 3, carbs_g: 13, fibre_g: null },
    totalGrams: 2000,
    effectiveGrams: 2000,
    engineVersion: 1,
  },
  is_archived: false,
  source_url: null,
  recipe_ingredients: [],
  ...overrides,
});

// A context for the recipe tools whose caller is the in-memory database, with the board's three foods.
export function recipeContext(
  tools: readonly ToolDefinition[],
  options: { rows?: Record<string, Record<string, unknown>[]> } = {},
) {
  const diet = dietRows();
  const foods = recipeFoods();
  return writeContext(tools, {
    rows: {
      foods: [...diet.foods, ...foods.foods],
      food_portions: [...diet.food_portions, ...foods.food_portions],
      ...options.rows,
    },
    rpc: { save_recipe: saveRecipeRpc },
  });
}
