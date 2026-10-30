import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import { makeFood, makePortion } from "./support";

import type { Food, FoodPortion, OffProductResponse } from "@keylow/core/schemas";
import type { ReactNode } from "react";

/** A time before `OFF_PORTION_RULES_FROM`, so a food fetched then is asked for again. */
export const FETCHED_BEFORE_THE_RULES = "2026-10-20T10:00:00.000000+00:00";
/** A time after `OFF_PORTION_RULES_FROM`, so a food fetched then needs nothing. */
export const FETCHED_AFTER_THE_RULES = "2026-10-24T10:00:00.000000+00:00";

export const BRANDED_FOOD_ID = "66666666-6666-4666-8666-666666666666";
export const BRANDED_CODE = "5449000000996";

/** A branded food stored before the portion rules, the kind the refresh is for. */
export function oldBrandedFood(overrides: Partial<Food> = {}): Food {
  return makeFood({
    id: BRANDED_FOOD_ID,
    owner_id: null,
    source: "off",
    source_ref: BRANDED_CODE,
    barcode: BRANDED_CODE,
    name: "Cola",
    brand: "Fizz",
    kcal: 42,
    protein_g: 0,
    fat_g: 0,
    carbs_g: 10.6,
    fetched_at: FETCHED_BEFORE_THE_RULES,
    ...overrides,
  });
}

/** The portions the food had under the old rules: a serving and a bottle, and no can. */
export function oldBrandedPortions(food: Food): FoodPortion[] {
  return [
    makePortion({
      id: "77777777-7777-4777-8777-777777777771",
      food_id: food.id,
      owner_id: null,
      label: "1 serving",
      grams: 150,
      is_default: true,
    }),
    makePortion({
      id: "77777777-7777-4777-8777-777777777774",
      food_id: food.id,
      owner_id: null,
      label: "1 bottle",
      grams: 500,
      position: 1,
    }),
  ];
}

/** What `off-product` answers for the food under the current rules: fetched now, with a can, and every portion with a new id. */
export function refreshedBrandedProduct(food: Food): OffProductResponse {
  return {
    food: { ...food, fetched_at: FETCHED_AFTER_THE_RULES },
    portions: [
      makePortion({
        id: "77777777-7777-4777-8777-777777777772",
        food_id: food.id,
        owner_id: null,
        label: "1 can",
        grams: 330,
        is_default: true,
      }),
      makePortion({
        id: "77777777-7777-4777-8777-777777777773",
        food_id: food.id,
        owner_id: null,
        label: "1 serving",
        grams: 150,
        position: 1,
      }),
      makePortion({
        id: "77777777-7777-4777-8777-777777777775",
        food_id: food.id,
        owner_id: null,
        label: "1 bottle",
        grams: 500,
        position: 2,
      }),
    ],
  };
}

type OffRefreshBackend = {
  /** The foods table, by id. */
  foods: Map<string, Food>;
  /** The portions table, by food id. */
  portions: Map<string, FoodPortion[]>;
  /** What `off-product` answers with. */
  product: OffProductResponse | undefined;
  /** Makes `off-product` fail: with a rate limit, or with a server error that quotes the food. */
  refreshFails: "rateLimited" | "serverError" | undefined;
  /** The Open Food Facts codes `off-product` was asked for, in order. */
  refreshedCodes: string[];
  /** `off-product` waits here while the test holds the refresh, as a slow connection does. */
  refreshGate: Promise<void> | undefined;
};

export const offRefreshBackend: OffRefreshBackend = {
  foods: new Map(),
  portions: new Map(),
  product: undefined,
  refreshFails: undefined,
  refreshedCodes: [],
  refreshGate: undefined,
};

export function resetOffRefreshBackend(): void {
  offRefreshBackend.foods = new Map();
  offRefreshBackend.portions = new Map();
  offRefreshBackend.product = undefined;
  offRefreshBackend.refreshFails = undefined;
  offRefreshBackend.refreshedCodes = [];
  offRefreshBackend.refreshGate = undefined;
}

/** Makes the refresh that follows wait until the returned function is called. */
export function holdRefresh(): () => void {
  let release: () => void = () => undefined;
  offRefreshBackend.refreshGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return release;
}

/** Stores the food and its portions, and has `off-product` answer with the refreshed product. */
export function storeOldBrandedFood(
  food: Food,
  portions: FoodPortion[] = oldBrandedPortions(food),
) {
  offRefreshBackend.foods.set(food.id, food);
  offRefreshBackend.portions.set(food.id, portions);
  offRefreshBackend.product = refreshedBrandedProduct(food);
}

const jsonResponse = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

// PostgREST answers one object when the caller asked for one (`maybeSingle`), otherwise the rows.
function rowsResponse(request: Request, rows: readonly unknown[]): Response {
  if (!(request.headers.get("accept") ?? "").includes("vnd.pgrst.object+json")) {
    return jsonResponse(rows);
  }
  const [row] = rows;
  return row !== undefined && rows.length === 1
    ? jsonResponse(row)
    : jsonResponse(
        { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" },
        406,
      );
}

const idOf = (url: URL, column: string) =>
  (url.searchParams.get(column) ?? "").replace(/^eq\./, "");

async function answerOffProduct(request: Request): Promise<Response> {
  const body: unknown = await request.json();
  if (
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    typeof body.code === "string"
  ) {
    offRefreshBackend.refreshedCodes.push(body.code);
  }
  await offRefreshBackend.refreshGate;
  if (offRefreshBackend.refreshFails === "rateLimited") {
    return jsonResponse(
      { error: { code: "rate_limited", message: "Slow down", retryAfterSeconds: 20 } },
      429,
      { "Retry-After": "20" },
    );
  }
  if (offRefreshBackend.refreshFails === "serverError" || offRefreshBackend.product === undefined) {
    return jsonResponse({ message: "RAW ROW Cola 42 kcal" }, 500);
  }
  return jsonResponse(offRefreshBackend.product);
}

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const url = new URL(request.url);

  if (url.pathname.endsWith("/foods") && request.method === "GET") {
    const food = offRefreshBackend.foods.get(idOf(url, "id"));
    return rowsResponse(request, food === undefined ? [] : [food]);
  }
  if (url.pathname.endsWith("/food_portions") && request.method === "GET") {
    return rowsResponse(request, offRefreshBackend.portions.get(idOf(url, "food_id")) ?? []);
  }
  if (url.pathname.endsWith("/functions/v1/off-product") && request.method === "POST") {
    return answerOffProduct(request);
  }
  return jsonResponse({ message: "unexpected request" }, 404);
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

/** The real api-client over the fake database above. A failed read is shown at once, with no retries. */
export function OffRefreshProvider({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return (
    <KeyLowProvider client={client} queryClient={queryClient}>
      {children}
    </KeyLowProvider>
  );
}

/** Gives a request that was wrongly sent time to arrive, so a test that expects none can trust its silence. */
export const letRequestsArrive = () => new Promise<void>((resolve) => setTimeout(resolve, 80));
