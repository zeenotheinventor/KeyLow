// off-product: the only writer of shared Open Food Facts rows. Given a barcode it returns the cached
// food and its portions. A missing barcode is fetched from OFF, normalised and stored. A stale one
// is returned at once and refreshed after the response. A food stored before the current portion
// rules is fetched again first, so its answer carries the new portions. Fetching is limited per user
// and globally.
//
// Things to know when changing this file:
// - A store is one call to the database function `store_off_product`, which upserts the food,
//   replaces its portions and upserts its raw data in one transaction (ADR 0003, Amendment 7). A
//   reader sees the old product or the new one, never a food without its portions, and a store that
//   fails halfway leaves the old product in place.
// - Simultaneous first lookups of one barcode all fetch and all call it. The food upsert inside takes
//   the row lock that makes the writers queue, so each one succeeds and the last to commit wins. No
//   unique violation can come back from it. Each caller answers with what its own call stored, and
//   the last writer replaces the portions, so a losing caller's response can carry portion ids that
//   no longer exist. The old code had the same gap. It is accepted: concurrent first lookups of one
//   barcode are rare in a personal app.
// - A stale row is claimed before it is refreshed: one update moves `fetched_at` forward, only if it
//   still has the value that was read. Only the request whose update changed a row refreshes, the
//   rest answer from the cache. The consequence is accepted: a refresh that does not succeed (OFF is
//   down, the product has vanished, the global limit refused it) leaves the cached data in place
//   with `fetched_at` advanced, so it is tried again after the next 90 days, not on every lookup.
//   A claim that errors is reported and counts as not claimed, so a stale row is still served from the
//   cache and the next lookup tries again.
// - A food whose `fetched_at` is before `OFF_PORTION_RULES_FROM` (core) was stored under older portion
//   rules, so it lacks the portions the current rules derive. It is fetched and stored inline, as a
//   first lookup is and charged like one, and the response carries the new portions. The store
//   advances `fetched_at`, so each product is refreshed once. If OFF fails, the product has vanished,
//   the limit is reached or the store fails, the cached product is returned as it is and nothing is
//   thrown. `fetched_at` stays where it was then, so the next lookup tries again, and each try is
//   charged. This takes the place of the 90 day claim for such a food. To bring stored products up to
//   date after a change to the portion rules, bump `OFF_PORTION_RULES_FROM` to the moment the change
//   is live in production (ADR 0003, Amendment 10). The 90 day path below is for the rest.
// - The row is stored under the barcode that was asked for (`source_ref`), and `barcode` is the code
//   OFF reports for the product. They are equal for every normal product. If OFF reports another
//   code, a lookup of that code finds no row and fetches it again as its own row.
import { z } from "zod";

import { requireUser } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/clients.ts";
import {
  normaliseBarcode,
  normaliseOffProduct,
  offProductPayloadSchema,
  offProductRequestSchema,
  offProductResponseSchema,
} from "../_shared/core.ts";
import { planCachedLookup } from "../_shared/cachedLookupPlan.ts";
import { error, handle, json } from "../_shared/http.ts";
import { offRequest } from "../_shared/off.ts";
import { reportError } from "../_shared/report.ts";
import { consume, readLimit } from "../_shared/rateLimit.ts";
import { runInBackground } from "../_shared/runtime.ts";

import type { OffProductResponse } from "../_shared/core.ts";
import type { Database } from "../_shared/core/database.types.ts";

type Service = ReturnType<typeof createServiceClient>;
type DatabaseFoodRow = Omit<Database["public"]["Tables"]["foods"]["Row"], "search">;
// An OFF row always has a fetch time (the foods_fetched_at_matches_source check), so it is a string here.
type FoodRow = Omit<DatabaseFoodRow, "fetched_at"> & { fetched_at: string };
type PortionRow = Database["public"]["Tables"]["food_portions"]["Row"];
type StoredProduct = { food: FoodRow; portions: PortionRow[] };
type OffProduct = Record<string, z.infer<ReturnType<typeof z.json>>>;
type Failed = { ok: false; failure: Response };

const rateLimitWindowSeconds = 60;
const globalBucket = "off-product:global";

// Exactly what offProductPayloadSchema reads, so the two cannot drift apart.
const offFields = Object.keys(offProductPayloadSchema.shape);

// Every foods column except `search`, which is generated and never leaves the database.
const foodColumns =
  "id, source, source_ref, owner_id, name, brand, barcode, basis, density_g_per_ml, kcal, protein_g, fat_g, sat_fat_g, carbs_g, sugars_g, fibre_g, salt_g, micros, quality, food_group, fetched_at, deleted_at, created_at";
const portionColumns = "id, food_id, owner_id, label, grams, ml, is_default, position, created_at";

// OFF answers `{ status: 0 }` for an unknown code, with a 404 or, at times, a 200.
const offAnswerSchema = z.object({
  status: z.number().optional(),
  product: z.record(z.string(), z.json()).optional(),
});

Deno.serve(
  handle("off-product", async (request) => {
    const user = await requireUser(request);
    if (user instanceof Response) {
      return user;
    }
    const code = await readBarcode(request);
    if (code instanceof Response) {
      return code;
    }

    const service = createServiceClient();
    const cached = await findCachedProduct(service, code);
    if (cached !== null) {
      const plan = planCachedLookup(cached.food.fetched_at, new Date());
      if (plan === "refresh_before_answering") {
        return respond(await refreshBeforeAnswering(service, user.id, code, cached));
      }
      if (plan === "answer_then_refresh" && (await claimRefresh(service, cached.food))) {
        runInBackground(refreshProduct(service, code));
      }
      return respond(cached);
    }

    const refused = await chargeLookup(user.id);
    if (refused !== null) {
      return refused;
    }
    const fetched = await fetchAndStoreProduct(service, code);
    return fetched.ok ? respond(fetched) : fetched.failure;
  }),
);

async function readBarcode(request: Request): Promise<string | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("invalid_request", "The request body must be JSON.");
  }
  const parsed = offProductRequestSchema.safeParse(body);
  if (!parsed.success) {
    return error("invalid_request", "Send a code of 8 to 14 digits.");
  }
  const barcode = normaliseBarcode(parsed.data.code);
  if (!barcode.ok) {
    return error("invalid_request", "That is not a valid barcode.");
  }
  return barcode.code;
}

async function findCachedProduct(service: Service, code: string): Promise<StoredProduct | null> {
  const { data: food, error: foodError } = await service
    .from("foods")
    .select(foodColumns)
    .eq("source", "off")
    .eq("source_ref", code)
    .maybeSingle();
  if (foodError !== null) {
    throw new Error(`Reading the cached food failed: ${foodError.message}`);
  }
  if (food === null) {
    return null;
  }
  const { data: portions, error: portionError } = await service
    .from("food_portions")
    .select(portionColumns)
    .eq("food_id", food.id)
    .is("owner_id", null)
    .order("position");
  if (portionError !== null) {
    throw new Error(`Reading the cached portions failed: ${portionError.message}`);
  }
  return { food: toOffFood(food), portions };
}

function toOffFood(food: DatabaseFoodRow): FoodRow {
  if (food.fetched_at === null) {
    throw new Error(`The OFF food ${food.id} has no fetch time`);
  }
  return { ...food, fetched_at: food.fetched_at };
}

// Moves `fetched_at` forward only while it still has the value this request read. The update that
// changes a row wins the right to refresh, so a burst of lookups of one stale row refreshes it once.
async function claimRefresh(service: Service, food: FoodRow): Promise<boolean> {
  const { data: claimed, error: claimError } = await service
    .from("foods")
    .update({ fetched_at: new Date().toISOString() })
    .eq("id", food.id)
    .eq("fetched_at", food.fetched_at)
    .select("id");
  if (claimError !== null) {
    // The cache can still answer, so a failed claim is not worth a 500. Nobody refreshes this time.
    reportError("off-product", "internal_error", claimError);
    return false;
  }
  return claimed.length > 0;
}

// A lookup that has to call OFF costs the user a hit first, and the whole service a hit second. A
// user who is over their limit never reaches the global bucket.
async function chargeLookup(userId: string): Promise<Response | null> {
  const perUserLimit = readLimit("OFF_PRODUCT_PER_USER_PER_MIN", 30);
  const globalLimit = readLimit("OFF_PRODUCT_GLOBAL_PER_MIN", 80);
  return (
    (await consume(`off-product:user:${userId}`, perUserLimit, rateLimitWindowSeconds)) ??
    (await consume(globalBucket, globalLimit, rateLimitWindowSeconds))
  );
}

// For a food stored before the current portion rules. The user asked for this product, so the lookup
// is charged like a first one. Whatever stops the refresh, the cached product still answers: the
// person gets the old portions, never an error for a product we hold.
async function refreshBeforeAnswering(
  service: Service,
  userId: string,
  code: string,
  cached: StoredProduct,
): Promise<StoredProduct | OffProductResponse> {
  try {
    if ((await chargeLookup(userId)) !== null) {
      console.warn(`off-product kept the old portions of ${code}, a limit is reached`);
      return cached;
    }
    const refreshed = await fetchAndStoreProduct(service, code);
    if (!refreshed.ok) {
      console.warn(
        `off-product kept the old portions of ${code}, the refresh answered ${refreshed.failure.status}`,
      );
      return cached;
    }
    return refreshed;
  } catch (caught) {
    reportError("off-product", "internal_error", caught);
    return cached;
  }
}

// Server initiated, so it costs the global bucket only. It runs after the response, so it catches
// and reports everything: nothing is left to answer for an error.
async function refreshProduct(service: Service, code: string): Promise<void> {
  try {
    const globalLimit = readLimit("OFF_PRODUCT_GLOBAL_PER_MIN", 80);
    if ((await consume(globalBucket, globalLimit, rateLimitWindowSeconds)) !== null) {
      console.warn(`off-product skipped the refresh of ${code}, the global limit is reached`);
      return;
    }
    const refreshed = await fetchAndStoreProduct(service, code);
    if (!refreshed.ok) {
      console.warn(
        `off-product could not refresh ${code}, the answer was ${refreshed.failure.status}`,
      );
    }
  } catch (caught) {
    reportError("off-product", "internal_error", caught);
  }
}

async function fetchAndStoreProduct(
  service: Service,
  code: string,
): Promise<({ ok: true } & OffProductResponse) | Failed> {
  const fetched = await fetchOffProduct(code);
  if (!fetched.ok) {
    return fetched;
  }
  const normalised = normaliseOffProduct(fetched.product);
  if (!normalised.ok) {
    // OFF has the product, so this is not a not_found. It is data we cannot use.
    reportError("off-product", "upstream_error", new Error(normalised.reason));
    return {
      ok: false,
      failure: error("upstream_error", "Open Food Facts returned a product that cannot be used."),
    };
  }
  return { ok: true, ...(await storeProduct(service, code, normalised, fetched.product)) };
}

async function fetchOffProduct(code: string): Promise<{ ok: true; product: OffProduct } | Failed> {
  const result = await offRequest(`/api/v2/product/${code}`, {
    functionName: "off-product",
    fields: offFields,
    acceptedStatuses: [404],
  });
  if (!result.ok) {
    return result;
  }
  const { response } = result;
  if (response.status === 404) {
    await response.body?.cancel();
    return notFound();
  }
  let answer: z.infer<typeof offAnswerSchema>;
  try {
    answer = offAnswerSchema.parse(await response.json());
  } catch (caught) {
    reportError("off-product", "upstream_error", caught);
    return {
      ok: false,
      failure: error("upstream_error", "Open Food Facts answered in an unexpected form."),
    };
  }
  if (answer.status === 0) {
    return notFound();
  }
  if (answer.product === undefined) {
    reportError(
      "off-product",
      "upstream_error",
      new Error("Open Food Facts answered without a product"),
    );
    return {
      ok: false,
      failure: error("upstream_error", "Open Food Facts answered without a product."),
    };
  }
  return { ok: true, product: answer.product };
}

function notFound(): Failed {
  return {
    ok: false,
    failure: error("not_found", "Open Food Facts has no product with this barcode."),
  };
}

type NormalisedProduct = Extract<ReturnType<typeof normaliseOffProduct>, { ok: true }>;

// The whole store is one database call, so it either happens or does not. The database function
// answers with the food and portions this call stored, which are parsed with the contract schema. A
// later writer may have replaced those portions by the time the response is read.
async function storeProduct(
  service: Service,
  code: string,
  normalised: NormalisedProduct,
  rawProduct: OffProduct,
): Promise<OffProductResponse> {
  const { data, error: storeError } = await service.rpc("store_off_product", {
    p_food: { ...normalised.food, source: "off", source_ref: code },
    p_portions: normalised.portions.map(({ label, grams, ml, isDefault }) => ({
      label,
      grams,
      ml,
      is_default: isDefault,
    })),
    p_raw: rawProduct,
  });
  if (storeError !== null) {
    throw new Error(`Storing the product failed: ${storeError.message}`);
  }
  return offProductResponseSchema.parse(data);
}

// Parsing with the contract schema means the function can never send a shape the client rejects.
function respond({ food, portions }: StoredProduct | OffProductResponse): Response {
  return json(offProductResponseSchema.parse({ food, portions }));
}
