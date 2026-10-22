import { foodRowSchema } from "@keylow/core/schemas";
import { createClient } from "@supabase/supabase-js";

import { diaryBackend, fakeFetch, resetDiaryBackend } from "./diaryBackend";

import type { Database } from "@keylow/api-client";
import type { Food, FoodPortion } from "@keylow/core/schemas";

/**
 * The fake database of `diaryBackend` plus what the entry screen reads beyond a day: one entry by its id,
 * and the food an entry was logged from with its portions. An update of an entry answers with the whole
 * stored row, which is what the real database returns for the columns the diary selects. Everything else
 * is `diaryBackend`'s own, including its failures and its record of every write.
 */
export const entryBackend: {
  /** The foods the database holds, deleted ones included: an entry reads its food unfiltered. */
  foods: Food[];
  foodPortions: FoodPortion[];
} = { foods: [], foodPortions: [] };

export function resetEntryBackend(): void {
  resetDiaryBackend();
  entryBackend.foods = [];
  entryBackend.foodPortions = [];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const idOf = (search: URLSearchParams, column: string): string | undefined =>
  search.get(column)?.replace("eq.", "");

const isLive = (row: Record<string, unknown>): boolean => (row["deleted_at"] ?? null) === null;

// An update that selects the entry's columns answers with the stored row, as an object when it asked for one.
function storedRow(row: Record<string, unknown>, init?: RequestInit): Response {
  const wantsObject = new Headers(init?.headers).get("Accept")?.includes("vnd.pgrst.object+json");

  return jsonResponse(wantsObject === true ? row : [row]);
}

async function entryFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const { pathname, searchParams } = new URL(address);
  const table = pathname.split("/").pop() ?? "";
  const method = init?.method ?? "GET";

  if (method === "GET" && table === "foods") {
    const food = entryBackend.foods.find((candidate) => candidate.id === idOf(searchParams, "id"));
    diaryBackend.requests.push({ table, search: searchParams.toString(), method });

    return jsonResponse(food === undefined ? [] : [foodRowSchema.parse(food)]);
  }
  if (method === "GET" && table === "food_portions") {
    diaryBackend.requests.push({ table, search: searchParams.toString(), method });
    if (diaryBackend.hungTables.has(table)) {
      return new Promise(() => undefined);
    }

    return jsonResponse(
      entryBackend.foodPortions.filter(
        (portion) => portion.food_id === idOf(searchParams, "food_id"),
      ),
    );
  }
  if (method === "GET" && table === "food_log_entries" && searchParams.has("id")) {
    diaryBackend.requests.push({ table, search: searchParams.toString(), method });
    if (diaryBackend.hungTables.has(table)) {
      return new Promise(() => undefined);
    }
    if (diaryBackend.failingTables.has(table)) {
      return jsonResponse(
        { code: "XX000", message: "raw database text", details: null, hint: null },
        500,
      );
    }
    const row = diaryBackend.entries.find(
      (entry) => entry["id"] === idOf(searchParams, "id") && isLive(entry),
    );

    return jsonResponse(row === undefined ? [] : [row]);
  }

  const response = await fakeFetch(input, init);
  if (
    method === "PATCH" &&
    table === "food_log_entries" &&
    response.ok &&
    searchParams.get("select")?.includes("snapshot") === true
  ) {
    const row = diaryBackend.entries.find((entry) => entry["id"] === idOf(searchParams, "id"));

    return row === undefined ? jsonResponse([]) : storedRow(row, init);
  }

  return response;
}

/** A real Supabase client whose network is the fake database above. */
export const entryClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: entryFetch },
});
