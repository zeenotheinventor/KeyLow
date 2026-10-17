import { createClient } from "@supabase/supabase-js";

import { diaryBackend, fakeFetch } from "./diaryBackend";

import type { Database } from "@keylow/api-client";

// The recipe writes over the diary's fake database: archiving is an update of `is_archived`, and a copy is
// the `save_recipe` call after a read of the original. Everything else goes to the diary's own fake fetch,
// so the library is read as it always is. The knobs are the diary's: `failingWriteTables` and
// `hungWriteTables`, with the table named `recipes` for an archive and a copy alike.

type Row = Record<string, unknown>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const idFilterOf = (search: URLSearchParams): string | undefined =>
  search.get("id")?.replace("eq.", "");

/** Holds each copy's `save_recipe` call until a test lets it go, by calling the function it was queued as in `held`. */
export const heldCopies: { isHolding: boolean; held: (() => void)[] } = {
  isHolding: false,
  held: [],
};

let copyCount = 0;

// The recipe a copy is made from is the one read just before it. The real function computes the totals from
// the ingredients, and this fake has none, so the copy takes the original's totals.
let lastRead: Row | undefined;

function recordRequest(table: string, search: URLSearchParams, method: string): void {
  diaryBackend.requests.push({ table, search: search.toString(), method });
}

function bodyOf(init?: RequestInit): Row {
  return typeof init?.body === "string" ? (JSON.parse(init.body) as Row) : {};
}

function fieldOf(source: unknown, key: string): unknown {
  return typeof source === "object" && source !== null
    ? Object.getOwnPropertyDescriptor(source, key)?.value
    : undefined;
}

const databaseError = () =>
  json({ code: "XX000", message: "raw database text", details: null, hint: null }, 500);

function archive(init: RequestInit, search: URLSearchParams): Response {
  const picked = diaryBackend.recipes.filter((row) => row["id"] === idFilterOf(search));
  for (const row of picked) {
    Object.assign(row, bodyOf(init));
  }
  const [only] = picked;
  const wantsObject = new Headers(init.headers).get("Accept")?.includes("vnd.pgrst.object+json");
  if (wantsObject !== true) {
    return json(picked);
  }

  return only === undefined
    ? json({ code: "PGRST116", message: "Cannot coerce", details: null, hint: null }, 406)
    : json(only);
}

function saveCopy(init: RequestInit): Response {
  const recipe = fieldOf(bodyOf(init), "p_recipe");
  copyCount += 1;
  const id = `00000000-0000-4000-8000-${String(900000 + copyCount).padStart(12, "0")}`;
  diaryBackend.recipes.push({
    id,
    name: fieldOf(recipe, "name"),
    servings: fieldOf(recipe, "servings"),
    yield_grams: fieldOf(recipe, "yield_grams"),
    instructions: fieldOf(recipe, "instructions"),
    computed: lastRead?.["computed"] ?? fieldOf(recipe, "computed"),
    is_archived: false,
  });

  return json(id);
}

function recipeWriteFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> | undefined {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const { pathname, searchParams } = new URL(address);
  const table = pathname.split("/").pop() ?? "";
  const method = init?.method ?? "GET";

  const isArchive = table === "recipes" && method === "PATCH";
  const isCopy = table === "save_recipe" && method === "POST";
  const isOneRead =
    table === "recipes" && method === "GET" && idFilterOf(searchParams) !== undefined;
  if (!isArchive && !isCopy && !isOneRead) {
    return undefined;
  }

  recordRequest(table, searchParams, method);
  if (isOneRead) {
    // The read of one recipe, which brings its ingredients: none here, since a copy needs only its servings.
    const rows = diaryBackend.recipes.filter((row) => row["id"] === idFilterOf(searchParams));
    lastRead = rows[0];

    return Promise.resolve(
      json(rows.map((row) => ({ instructions: [], ...row, recipe_ingredients: [] }))),
    );
  }
  if (diaryBackend.hungWriteTables.has("recipes")) {
    return new Promise(() => undefined);
  }
  if (diaryBackend.failingWriteTables.has("recipes")) {
    return Promise.resolve(databaseError());
  }

  if (init === undefined) {
    return Promise.resolve(databaseError());
  }
  if (isCopy && heldCopies.isHolding) {
    return new Promise((release) => {
      heldCopies.held.push(() => {
        release(saveCopy(init));
      });
    });
  }

  return Promise.resolve(isArchive ? archive(init, searchParams) : saveCopy(init));
}

/** A real Supabase client whose network is the diary's fake database, with the recipe writes added. */
export const recipeWritesClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) => recipeWriteFetch(input, init) ?? fakeFetch(input, init),
  },
});
