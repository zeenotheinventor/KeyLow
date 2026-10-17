import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import type { RecipeSummary } from "@keylow/api-client";
import type { ReactNode } from "react";

/** What the database holds for the recipe search and the log: its rows, and the requests it was sent. */
type RecipeLogBackend = {
  /** The recipes table, live and archived. */
  recipes: RecipeSummary[];
  /** Answers the recipe search with a server error that quotes a row. */
  failsSearch: boolean;
  /** Answers an insert into the diary with a server error that quotes a row. */
  failsInsert: boolean;
  /** The URLs of the recipe searches, in order. */
  searches: string[];
  /** The bodies of the inserts into the diary, in order. */
  inserts: Record<string, unknown>[];
  /** The ids of the entries that were soft deleted, in order. */
  deletedIds: string[];
  /** An insert waits here while the test holds it, as a slow connection does. */
  insertGate: Promise<void> | undefined;
  /** A recipe search waits here while the test holds it. */
  searchGate: Promise<void> | undefined;
};

// The entries stored so far, which gives each a new id.
let storedEntries = 0;

export const recipeLogBackend: RecipeLogBackend = {
  recipes: [],
  failsSearch: false,
  failsInsert: false,
  searches: [],
  inserts: [],
  deletedIds: [],
  insertGate: undefined,
  searchGate: undefined,
};

export function resetRecipeLogBackend(): void {
  recipeLogBackend.recipes = [];
  recipeLogBackend.failsSearch = false;
  recipeLogBackend.failsInsert = false;
  recipeLogBackend.searches = [];
  recipeLogBackend.inserts = [];
  recipeLogBackend.deletedIds = [];
  recipeLogBackend.insertGate = undefined;
  recipeLogBackend.searchGate = undefined;
  storedEntries = 0;
}

/** Makes the inserts that follow wait until the returned function is called. */
export function holdInserts(): () => void {
  let release: () => void = () => undefined;
  recipeLogBackend.insertGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return release;
}

/** Makes the recipe searches that follow wait until the returned function is called. */
export function holdSearches(): () => void {
  let release: () => void = () => undefined;
  recipeLogBackend.searchGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return release;
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const serverError = () =>
  jsonResponse(
    { code: "XX000", message: "RAW ROW Chicken and rice 374", details: null, hint: null },
    500,
  );

// The search asks for `ilike.%chicken%` over the live rows, in name order.
async function recipeSearch(url: URL): Promise<Response> {
  recipeLogBackend.searches.push(`${url.pathname}${url.search}`);
  await recipeLogBackend.searchGate;
  if (recipeLogBackend.failsSearch) {
    return serverError();
  }
  const needle = (url.searchParams.get("name") ?? "").replace(/^ilike\./, "").replaceAll("%", "");
  const onlyLive = url.searchParams.get("is_archived") === "eq.false";

  return jsonResponse(
    recipeLogBackend.recipes
      .filter((recipe) => recipe.name.toLowerCase().includes(needle.toLowerCase()))
      .filter((recipe) => !onlyLive || !recipe.is_archived)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

async function entryInsert(request: Request): Promise<Response> {
  const body: unknown = await request.json();
  if (typeof body !== "object" || body === null) {
    return jsonResponse({ message: "unexpected request" }, 400);
  }
  recipeLogBackend.inserts.push({ ...body });
  await recipeLogBackend.insertGate;
  if (recipeLogBackend.failsInsert) {
    return serverError();
  }
  storedEntries += 1;
  const id = `00000000-0000-4000-8000-${String(900 + storedEntries).padStart(12, "0")}`;

  // The database works the entry's energy out of its nutrients, and answers with it.
  const kcal =
    "nutrients" in body &&
    typeof body.nutrients === "object" &&
    body.nutrients !== null &&
    "kcal" in body.nutrients
      ? body.nutrients.kcal
      : null;

  return jsonResponse({ ...body, id, kcal, created_at: "2026-10-15T12:40:31+00:00" }, 201);
}

function entryDelete(url: URL): Response {
  const id = (url.searchParams.get("id") ?? "").replace(/^eq\./, "");
  recipeLogBackend.deletedIds.push(id);

  return jsonResponse({ id });
}

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const url = new URL(request.url);

  if (url.pathname.endsWith("/recipes") && request.method === "GET") {
    return recipeSearch(url);
  }
  if (url.pathname.endsWith("/food_log_entries") && request.method === "POST") {
    return entryInsert(request);
  }
  if (url.pathname.endsWith("/food_log_entries") && request.method === "PATCH") {
    return entryDelete(url);
  }
  return jsonResponse({ message: "unexpected request" }, 404);
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

/** The real api-client over the fake database above. A failed read is shown at once, with no retries. */
export function RecipeLogProvider({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return (
    <KeyLowProvider client={client} queryClient={queryClient}>
      {children}
    </KeyLowProvider>
  );
}
