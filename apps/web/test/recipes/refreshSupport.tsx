import { KeyLowProvider } from "@keylow/api-client";
import { buildRecipeIngredient, computeRecipe } from "@keylow/core/recipes";
import { buildFood } from "@keylow/core/testing";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import { renderWithRouter } from "../ui/appRouter";

import type { StoredRecipe } from "@keylow/core/recipes";
import type { Food, FoodPortion } from "@keylow/core/schemas";
import type { ReactElement } from "react";

import { ToastProvider } from "@/components/ui/Toast";

export const REFRESH_RECIPE_ID = "55555555-5555-4555-8555-555555555555";

// The preamble's refresh sample: the user's own "Chicken breast fillets" go from 120 kcal, P 22.5, C 0 and
// F 2.1 per 100 g to 110, P 25, C 0 and F 1.0. Four servings make 1,496.8 kcal, P 126.5, C 170.2 and F 32.5,
// which become 1,446.8, P 139, C 170.2 and F 27.
const chickenAsSaved = buildFood({
  id: "00000000-0000-4000-8000-0000000000a1",
  source: "user",
  name: "Chicken breast fillets",
  kcal: 120,
  protein_g: 22.5,
  carbs_g: 0,
  fat_g: 2.1,
});
const rice = buildFood({
  id: "00000000-0000-4000-8000-0000000000a2",
  source: "cofid",
  name: "Long grain rice",
  kcal: 360,
  protein_g: 7,
  carbs_g: 85.1,
  fat_g: 1,
});
const oil = buildFood({
  id: "00000000-0000-4000-8000-0000000000a3",
  source: "cofid",
  name: "Olive oil",
  kcal: 884,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 100,
});

export type RefreshRecipe = StoredRecipe & { id: string; is_archived: boolean };

/** Chicken and rice as it was saved: 500 g, 200 g and 20 g of the three foods as they were. */
export const chickenAndRice: RefreshRecipe = {
  id: REFRESH_RECIPE_ID,
  name: "Chicken and rice",
  is_archived: false,
  servings: 4,
  yield_grams: 1100,
  instructions: ["Season the chicken.", "Brown it in the oil."],
  ingredients: [
    buildRecipeIngredient(chickenAsSaved, { quantity: 500, unit: "g" }),
    buildRecipeIngredient(rice, { quantity: 200, unit: "g" }),
    buildRecipeIngredient(oil, { quantity: 20, unit: "g" }),
  ],
};

/** The foods as they are today, after the user edited the chicken. */
export const foodsAfterTheChickenEdit: Food[] = [
  { ...chickenAsSaved, kcal: 110, protein_g: 25, fat_g: 1 },
  rice,
  oil,
];

/** The foods exactly as the recipe saved them, so nothing has changed. */
export const foodsAsSaved: Food[] = [chickenAsSaved, rice, oil];

/** The foods as they are today when the user has also deleted the olive oil. */
export const foodsWithTheOilDeleted: Food[] = [
  foodsAfterTheChickenEdit[0] ?? chickenAsSaved,
  rice,
  { ...oil, deleted_at: "2026-10-16T09:00:00.000Z" },
];

export const oilDeletedOnly: Food[] = [
  chickenAsSaved,
  rice,
  { ...oil, deleted_at: "2026-10-16T09:00:00.000Z" },
];

type Row = Record<string, unknown>;

type RefreshBackend = {
  /** The recipe as the database holds it. A save replaces its ingredients. */
  recipe: RefreshRecipe | undefined;
  /** The foods as they are today, deleted ones included, as the foods table holds them. */
  foods: Food[];
  portions: FoodPortion[];
  /** Fails every read of a food, as a connection that drops does. */
  failsFoodReads: boolean;
  /** Fails every read of a food after this many have been made. Null never fails. */
  failsFoodReadsAfter: number | null;
  /** Never answers a read of a food, as a slow connection does. */
  hangsFoodReads: boolean;
  /** Fails the next saves with a database error. */
  failsSaves: boolean;
  /** Holds each save until a test lets it go. */
  isHoldingSaves: boolean;
  held: (() => void)[];
  /** The bodies of the saves, in order. */
  saves: Row[];
  /** The reads of the foods table, in order. */
  foodReads: number;
  /** The reads of the recipe by id, in order. */
  recipeReads: number;
};

export const refreshBackend: RefreshBackend = {
  recipe: undefined,
  foods: [],
  portions: [],
  failsFoodReads: false,
  failsFoodReadsAfter: null,
  hangsFoodReads: false,
  failsSaves: false,
  isHoldingSaves: false,
  held: [],
  saves: [],
  foodReads: 0,
  recipeReads: 0,
};

export function resetRefreshBackend(): void {
  refreshBackend.recipe = undefined;
  refreshBackend.foods = [];
  refreshBackend.portions = [];
  refreshBackend.failsFoodReads = false;
  refreshBackend.failsFoodReadsAfter = null;
  refreshBackend.hangsFoodReads = false;
  refreshBackend.failsSaves = false;
  refreshBackend.isHoldingSaves = false;
  refreshBackend.held = [];
  refreshBackend.saves = [];
  refreshBackend.foodReads = 0;
  refreshBackend.recipeReads = 0;
}

/** Lets every held save go, in the order they were made. */
export function releaseSaves(): void {
  refreshBackend.isHoldingSaves = false;
  for (const release of refreshBackend.held.splice(0)) {
    release();
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const databaseError = () =>
  json({ code: "XX000", message: "raw database text", details: null, hint: null }, 500);

const equalsFilter = (search: URLSearchParams, column: string): string | undefined =>
  search.get(column)?.replace(/^eq\./, "");

// The recipe as the recipes table gives it: the columns, the nutrition cache and the ingredients in order.
function recipeRow(recipe: RefreshRecipe): Row {
  const { ingredients, ...columns } = recipe;

  return {
    ...columns,
    computed: computeRecipe({
      servings: recipe.servings,
      yieldGrams: recipe.yield_grams,
      ingredients: [...ingredients],
    }),
    recipe_ingredients: ingredients.map((ingredient, position) => ({ ...ingredient, position })),
  };
}

function saveRecipe(body: Row): Response {
  refreshBackend.saves.push(body);
  const recipe = refreshBackend.recipe;
  const ingredients = Array.isArray(body["p_ingredients"]) ? body["p_ingredients"] : [];
  if (recipe === undefined) {
    return json({ code: "P0002", message: "raw database text", details: null, hint: null }, 400);
  }
  refreshBackend.recipe = { ...recipe, ingredients };

  return json(recipe.id);
}

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const { pathname, searchParams } = new URL(request.url);
  const table = pathname.split("/").pop() ?? "";

  if (table === "foods" && request.method === "GET") {
    const reads = refreshBackend.foodReads;
    refreshBackend.foodReads += 1;
    if (refreshBackend.hangsFoodReads) {
      return new Promise<Response>(() => undefined);
    }
    if (
      refreshBackend.failsFoodReads ||
      (refreshBackend.failsFoodReadsAfter !== null && reads >= refreshBackend.failsFoodReadsAfter)
    ) {
      return databaseError();
    }
    const id = equalsFilter(searchParams, "id");

    return json(refreshBackend.foods.filter((food) => food.id === id));
  }
  if (table === "food_portions" && request.method === "GET") {
    const foodId = equalsFilter(searchParams, "food_id");

    return json(refreshBackend.portions.filter((portion) => portion.food_id === foodId));
  }
  if (table === "save_recipe" && request.method === "POST") {
    const body: unknown = await request.json();
    const written = typeof body === "object" && body !== null ? { ...body } : {};
    if (refreshBackend.failsSaves) {
      refreshBackend.saves.push(written);
      return databaseError();
    }
    if (refreshBackend.isHoldingSaves) {
      return new Promise<Response>((release) => {
        refreshBackend.held.push(() => {
          release(saveRecipe(written));
        });
      });
    }

    return saveRecipe(written);
  }
  if (table === "recipes" && request.method === "GET") {
    const recipe = refreshBackend.recipe;
    if (searchParams.has("id")) {
      refreshBackend.recipeReads += 1;
      return json(
        recipe !== undefined && recipe.id === equalsFilter(searchParams, "id")
          ? [recipeRow(recipe)]
          : [],
      );
    }

    return json(recipe === undefined ? [] : [recipeRow(recipe)]);
  }

  return json({ message: "unexpected request" }, 404);
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

/** Renders under a router, the toasts and the real api-client, whose network is the fake database above. */
export function renderWithRefresh(ui: ReactElement) {
  // A failed read is shown at once, where the app's own client would try it three more times first.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return {
    queryClient,
    ...renderWithRouter(
      <KeyLowProvider client={client} queryClient={queryClient}>
        <ToastProvider>{ui}</ToastProvider>
      </KeyLowProvider>,
    ),
  };
}
