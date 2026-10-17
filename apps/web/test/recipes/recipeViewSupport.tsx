import { KeyLowProvider } from "@keylow/api-client";
import { computeRecipe } from "@keylow/core/recipes";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import { renderWithRouter } from "../ui/appRouter";

import type { StoredRecipe } from "@keylow/core/recipes";
import type { ReactElement } from "react";

import { ToastProvider } from "@/components/ui/Toast";

export type SavedRecipe = StoredRecipe & { id: string; is_archived?: boolean };

type RecipeViewBackend = {
  /** The recipes the database holds, by id. */
  recipes: Map<string, SavedRecipe>;
  /** Answers the read with a server error. */
  fails: boolean;
  /** Never answers the read, as a slow connection does. */
  hangs: boolean;
  /** Every request the page made, in order. A page that only reads has nothing but GET in it. */
  requests: { method: string; path: string }[];
};

export const recipeViewBackend: RecipeViewBackend = {
  recipes: new Map(),
  fails: false,
  hangs: false,
  requests: [],
};

export function resetRecipeViewBackend(): void {
  recipeViewBackend.recipes = new Map();
  recipeViewBackend.fails = false;
  recipeViewBackend.hangs = false;
  recipeViewBackend.requests = [];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// A recipe as the recipes table gives it: the columns, the nutrition cache and the ingredients in order.
function rowOf(recipe: SavedRecipe) {
  const { ingredients, ...columns } = recipe;

  return {
    ...columns,
    is_archived: recipe.is_archived ?? false,
    computed: computeRecipe({
      servings: recipe.servings,
      yieldGrams: recipe.yield_grams,
      ingredients: [...ingredients],
    }),
    recipe_ingredients: ingredients.map((ingredient, position) => ({ ...ingredient, position })),
  };
}

function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const { pathname, searchParams } = new URL(request.url);
  recipeViewBackend.requests.push({ method: request.method, path: pathname });

  if (!pathname.endsWith("/recipes") || request.method !== "GET") {
    return Promise.resolve(jsonResponse({ message: "unexpected request" }, 404));
  }
  if (recipeViewBackend.hangs) {
    return new Promise<Response>(() => undefined);
  }
  if (recipeViewBackend.fails) {
    return Promise.resolve(
      jsonResponse(
        { code: "XX000", message: "database unavailable", details: null, hint: null },
        500,
      ),
    );
  }

  const id = searchParams.get("id")?.replace(/^eq\./, "");
  const recipe = id === undefined ? undefined : recipeViewBackend.recipes.get(id);

  return Promise.resolve(jsonResponse(recipe === undefined ? [] : [rowOf(recipe)]));
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

/** Renders under a router and the real api-client, whose network is the fake database above. */
export function renderWithRecipeView(ui: ReactElement) {
  // A failed read is shown at once, where the app's own client would try it three more times first.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return renderWithRouter(
    <KeyLowProvider client={client} queryClient={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </KeyLowProvider>,
  );
}
