import { KeyLowProvider } from "@keylow/api-client";
import { recipeComputedSchema, recipeIngredientSchema, recipeSchema } from "@keylow/core/recipes";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import { renderWithRouter } from "../ui/appRouter";

import type { RecipeSummary } from "@keylow/api-client";
import type { RecipeIngredient } from "@keylow/core/recipes";
import type { ReactElement } from "react";

import { sampleRecipes } from "@/components/recipes/sampleRecipes";
import { ToastProvider } from "@/components/ui/Toast";

/** What a recipe holds beyond its library row, which a copy is made from. */
type RecipeContents = { instructions: string[]; ingredients: readonly RecipeIngredient[] };

type RecipesBackend = {
  /** What the recipes table holds, live and archived. */
  rows: RecipeSummary[];
  /** The steps and ingredients of the recipes that have any, by id. A recipe without them has none. */
  contents: Map<string, RecipeContents>;
  /** Answers the read with a server error. */
  fails: boolean;
  /** Never answers the read, as a slow connection does. */
  hangs: boolean;
  /** The URLs of the reads of the library, in order. */
  reads: string[];
  /** Answers every write with a server error. */
  failsWrites: boolean;
  /** The writes the page made, in order: an archive or restore, and the save of a copy. */
  writes: string[];
};

export const recipesBackend: RecipesBackend = {
  rows: [],
  contents: new Map(),
  fails: false,
  hangs: false,
  reads: [],
  failsWrites: false,
  writes: [],
};

// The copies the page has saved, which gives each a new id.
let savedCopies = 0;

// A write waits here while the test holds the writes, as a slow connection does: before the database
// has taken it, or, for a save whose answer is slow, after.
type WriteMoment = "before" | "after";
let writeGate: { moment: WriteMoment; wait: Promise<void>; release: () => void } | undefined;

/**
 * Makes the writes that follow wait until `releaseWrites`, so the page can be seen while one is under way.
 * "before" holds a write back from the database, and "after" lets the database take it and holds its answer.
 */
export function holdWrites(moment: WriteMoment = "before"): void {
  let release: () => void = () => undefined;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  writeGate = { moment, wait, release };
}

async function waitAtGate(moment: WriteMoment): Promise<void> {
  if (writeGate?.moment === moment) {
    await writeGate.wait;
  }
}

export function releaseWrites(): void {
  writeGate?.release();
  writeGate = undefined;
}

export function resetRecipesBackend(): void {
  releaseWrites();
  recipesBackend.rows = [];
  recipesBackend.contents = new Map();
  recipesBackend.fails = false;
  recipesBackend.hangs = false;
  recipesBackend.reads = [];
  recipesBackend.failsWrites = false;
  recipesBackend.writes = [];
  savedCopies = 0;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const serverError = () =>
  jsonResponse({ code: "XX000", message: "database unavailable", details: null, hint: null }, 500);

function byNameThenId(a: RecipeSummary, b: RecipeSummary): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

// The library reads the lean columns, and a copy is made from a read with the ingredients and steps too.
function recipeRead(searchParams: URLSearchParams): Response {
  const id = searchParams.get("id")?.replace(/^eq\./, "");
  const row = recipesBackend.rows.find((candidate) => candidate.id === id);
  const contents = recipesBackend.contents.get(id ?? "");

  return jsonResponse(
    row === undefined
      ? []
      : [
          {
            ...row,
            instructions: contents?.instructions ?? [],
            recipe_ingredients: (contents?.ingredients ?? []).map((ingredient, position) => ({
              ...ingredient,
              position,
            })),
          },
        ],
  );
}

// The rows are replaced, not changed, because the tests share the sample recipes' objects.
async function archiveWrite(request: Request, searchParams: URLSearchParams): Promise<Response> {
  const body: unknown = await request.json();
  const id = searchParams.get("id")?.replace(/^eq\./, "");
  const row = recipesBackend.rows.find((candidate) => candidate.id === id);
  if (row === undefined || typeof body !== "object" || body === null || !("is_archived" in body)) {
    return jsonResponse({ code: "PGRST116", message: "no row", details: null, hint: null }, 406);
  }
  const archived = { ...row, is_archived: body.is_archived === true };
  recipesBackend.rows = recipesBackend.rows.map((candidate) =>
    candidate.id === row.id ? archived : candidate,
  );
  return jsonResponse(archived);
}

const savedRecipeSchema = recipeSchema
  .pick({ name: true, servings: true, yield_grams: true, instructions: true })
  .extend({ computed: recipeComputedSchema });

// `save_recipe` makes a new recipe when it is given no id, and answers with the id it chose.
async function saveRecipeWrite(request: Request): Promise<Response> {
  const body: unknown = await request.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("p_recipe" in body) ||
    !("p_ingredients" in body)
  ) {
    return jsonResponse({ message: "unexpected request" }, 400);
  }
  const { instructions, ...columns } = savedRecipeSchema.parse(body.p_recipe);

  savedCopies += 1;
  const id = `00000000-0000-4000-8000-${String(100 + savedCopies).padStart(12, "0")}`;
  recipesBackend.rows.push({ id, ...columns, is_archived: false });
  recipesBackend.contents.set(id, {
    instructions,
    ingredients: recipeIngredientSchema.array().parse(body.p_ingredients),
  });
  return jsonResponse(id);
}

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const { pathname, search, searchParams } = new URL(request.url);

  if (pathname.endsWith("/rpc/save_recipe") && request.method === "POST") {
    recipesBackend.writes.push("save_recipe");
    await waitAtGate("before");
    if (recipesBackend.failsWrites) {
      return serverError();
    }
    const saved = await saveRecipeWrite(request);
    await waitAtGate("after");
    return saved;
  }
  if (!pathname.endsWith("/recipes")) {
    return jsonResponse({ message: "unexpected request" }, 404);
  }
  if (request.method === "PATCH") {
    recipesBackend.writes.push("archive");
    await waitAtGate("before");
    if (recipesBackend.failsWrites) {
      return serverError();
    }
    const archived = await archiveWrite(request, searchParams);
    await waitAtGate("after");
    return archived;
  }
  if (request.method !== "GET") {
    return jsonResponse({ message: "unexpected request" }, 404);
  }
  if (searchParams.has("id")) {
    return recipeRead(searchParams);
  }

  recipesBackend.reads.push(`${pathname}${search}`);

  if (recipesBackend.hangs) {
    return new Promise<Response>(() => undefined);
  }
  if (recipesBackend.fails) {
    return serverError();
  }

  const onlyLive = search.includes("is_archived=eq.false");
  const rows = recipesBackend.rows.filter((row) => !onlyLive || !row.is_archived);
  return jsonResponse([...rows].sort(byNameThenId));
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

/** One of the boards' five live recipes, by name. */
export function sampleRecipeNamed(name: string): RecipeSummary {
  const recipe = sampleRecipes.find((candidate) => candidate.name === name);
  if (recipe === undefined) {
    throw new Error(`The sample recipes have no ${name}`);
  }
  return recipe;
}

/** Renders under a router, the toasts and the real api-client, whose network is the fake database above. */
export function renderWithRecipes(ui: ReactElement) {
  // A failed read is shown at once, where the app's own client would try it three more times first.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return renderWithRouter(
    <KeyLowProvider client={client} queryClient={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </KeyLowProvider>,
  );
}
