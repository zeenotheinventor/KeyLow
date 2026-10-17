import { computeRecipe } from "@keylow/core/recipes";
import { createClient } from "@supabase/supabase-js";

import { diaryBackend, fakeFetch } from "./diaryBackend";

import type { Database } from "@keylow/api-client";
import type { RecipeIngredient } from "@keylow/core/recipes";
import type { Food, FoodPortion } from "@keylow/core/schemas";

// "Refresh ingredients" over the diary's fake database: the foods a recipe is checked against, their
// portions, and the one `save_recipe` call that replaces a recipe's ingredients. Everything else goes to the
// diary's own fake fetch, so a recipe is read as it always is. A test sets `refreshBackend.foods` to the
// foods as they are now and `diaryBackend.recipes` to the recipe as it was saved.

type Row = Record<string, unknown>;

export const refreshBackend: {
  /** The foods as they are today, deleted ones included, as the foods table holds them. */
  foods: Food[];
  portions: FoodPortion[];
  /** Fails every read of a food after this many have been made, as one that fails after the check did not. Null never fails. */
  failsFoodReadsAfter: number | null;
  /** Fails the next save of a recipe with a database error. */
  failsSave: boolean;
  /** Holds each save until a test lets it go, by calling the function it was queued as in `held`. */
  isHoldingSaves: boolean;
  held: (() => void)[];
  /** The bodies of the saves, in order. */
  saves: Row[];
} = {
  foods: [],
  portions: [],
  failsFoodReadsAfter: null,
  failsSave: false,
  isHoldingSaves: false,
  held: [],
  saves: [],
};

export function resetRefreshBackend(): void {
  refreshBackend.foods = [];
  refreshBackend.portions = [];
  refreshBackend.failsFoodReadsAfter = null;
  refreshBackend.failsSave = false;
  refreshBackend.isHoldingSaves = false;
  refreshBackend.held = [];
  refreshBackend.saves = [];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const databaseError = () =>
  json({ code: "XX000", message: "raw database text", details: null, hint: null }, 500);

const equalsFilter = (search: URLSearchParams, column: string): string | undefined =>
  search.get(column)?.replace("eq.", "");

function bodyOf(init: RequestInit): Row {
  return typeof init.body === "string" ? (JSON.parse(init.body) as Row) : {};
}

function saveRecipe(init: RequestInit): Response {
  const body = bodyOf(init);
  refreshBackend.saves.push(body);
  const id = String(body["p_recipe_id"]);
  const recipe = diaryBackend.recipes.find((row) => row["id"] === id);
  if (recipe === undefined) {
    return json({ code: "P0002", message: "raw database text", details: null, hint: null }, 400);
  }
  const ingredients = Array.isArray(body["p_ingredients"]) ? body["p_ingredients"] : [];
  Object.assign(recipe, body["p_recipe"], {
    recipe_ingredients: ingredients.map((ingredient: unknown, position) => ({
      ...(typeof ingredient === "object" && ingredient !== null ? ingredient : {}),
      position,
    })),
  });

  return json(id);
}

function refreshFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> | undefined {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const { pathname, searchParams } = new URL(address);
  const table = pathname.split("/").pop() ?? "";
  const method = init?.method ?? "GET";

  if (table === "foods" && method === "GET") {
    const readsBefore = diaryBackend.requests.filter((request) => request.table === "foods").length;
    diaryBackend.requests.push({ table, search: searchParams.toString(), method });
    if (
      refreshBackend.failsFoodReadsAfter !== null &&
      readsBefore >= refreshBackend.failsFoodReadsAfter
    ) {
      return Promise.resolve(databaseError());
    }
    if (diaryBackend.hungTables.has(table)) {
      return new Promise(() => undefined);
    }
    if (diaryBackend.failingTables.has(table)) {
      return Promise.resolve(databaseError());
    }
    const id = equalsFilter(searchParams, "id");

    return Promise.resolve(json(refreshBackend.foods.filter((food) => food.id === id)));
  }
  if (table === "food_portions" && method === "GET") {
    diaryBackend.requests.push({ table, search: searchParams.toString(), method });
    const foodId = equalsFilter(searchParams, "food_id");

    return Promise.resolve(
      json(refreshBackend.portions.filter((portion) => portion.food_id === foodId)),
    );
  }
  if (table === "save_recipe" && method === "POST" && init !== undefined) {
    const isUpdate = bodyOf(init)["p_recipe_id"] !== null;
    if (!isUpdate) {
      return undefined;
    }
    diaryBackend.requests.push({ table, search: searchParams.toString(), method });
    if (refreshBackend.failsSave) {
      return Promise.resolve(databaseError());
    }
    if (refreshBackend.isHoldingSaves) {
      return new Promise((release) => {
        refreshBackend.held.push(() => {
          release(saveRecipe(init));
        });
      });
    }

    return Promise.resolve(saveRecipe(init));
  }
  return undefined;
}

/** A recipe as the database holds it: the library's columns, the steps, and the ingredients with their place. */
export function recipeRowOf(recipe: {
  id: string;
  name: string;
  servings: number;
  yield_grams: number | null;
  instructions: readonly string[];
  ingredients: readonly RecipeIngredient[];
}): Row {
  return {
    id: recipe.id,
    name: recipe.name,
    servings: recipe.servings,
    yield_grams: recipe.yield_grams,
    is_archived: false,
    instructions: recipe.instructions,
    computed: computeRecipe({
      servings: recipe.servings,
      yieldGrams: recipe.yield_grams,
      ingredients: recipe.ingredients,
    }),
    recipe_ingredients: recipe.ingredients.map((ingredient, position) => ({
      ...ingredient,
      position,
    })),
  };
}

/** A real Supabase client whose network is the diary's fake database, with the refresh's foods and save added. */
export const recipeRefreshClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) => refreshFetch(input, init) ?? fakeFetch(input, init),
  },
});
