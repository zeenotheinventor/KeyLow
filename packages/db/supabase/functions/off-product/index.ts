// off-product: the only writer of shared Open Food Facts rows. Given a barcode it returns the cached
// food and its portions. A missing barcode is fetched from OFF, normalised and stored. A stale one
// is returned at once and refreshed after the response. Fetching is limited per user and globally.
//
// Things to know when changing this file:
// - PostgREST has no transaction, so a store is a sequence of writes and the cache read is not
//   transactional. A reader can briefly see a fresh food with no portions while a refresh has
//   deleted the old portions and not yet inserted the new ones. A transactional upsert function in
//   the database is the follow-up that removes this.
// - Simultaneous first lookups of one barcode all fetch and all write. The food upsert is idempotent.
//   The portions insert of the losers collides on the one-default-portion index (23505), which means
//   another writer already stored them, so the loser answers with what is stored.
// - A stale row is claimed before it is refreshed: one update moves `fetched_at` forward, only if it
//   still has the value that was read. Only the request whose update changed a row refreshes, the
//   rest answer from the cache. The consequence is accepted: a refresh that does not succeed (OFF is
//   down, the product has vanished, the global limit refused it) leaves the cached data in place
//   with `fetched_at` advanced, so it is tried again after the next 90 days, not on every lookup.
//   A claim that errors is logged and counts as not claimed, so a stale row is still served from the
//   cache and the next lookup tries again.
// - The row is stored under the barcode that was asked for (`source_ref`), and `barcode` is the code
//   OFF reports for the product. They are equal for every normal product. If OFF reports another
//   code, a lookup of that code finds no row and fetches it again as its own row.
import { z } from "zod";

import { requireUser } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/clients.ts";
import {
  normaliseBarcode,
  normaliseOffProduct,
  offFreshness,
  offProductPayloadSchema,
  offProductRequestSchema,
  offProductResponseSchema,
} from "../_shared/core.ts";
import { error, handle, json } from "../_shared/http.ts";
import { offRequest } from "../_shared/off.ts";
import { consume, readLimit } from "../_shared/rateLimit.ts";
import { runInBackground } from "../_shared/runtime.ts";

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
      if (isStale(cached.food) && (await claimRefresh(service, cached.food))) {
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

function isStale(food: FoodRow): boolean {
  return offFreshness(food.fetched_at, new Date()) === "stale";
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
    console.error(`off-product could not claim the refresh of ${food.source_ref}`, claimError);
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

// Server initiated, so it costs the global bucket only. It runs after the response, so it catches
// and logs everything: nothing is left to answer for an error.
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
    console.error(`off-product failed to refresh ${code}`, caught);
  }
}

async function fetchAndStoreProduct(
  service: Service,
  code: string,
): Promise<({ ok: true } & StoredProduct) | Failed> {
  const fetched = await fetchOffProduct(code);
  if (!fetched.ok) {
    return fetched;
  }
  const normalised = normaliseOffProduct(fetched.product);
  if (!normalised.ok) {
    // OFF has the product, so this is not a not_found. It is data we cannot use.
    console.error(`off-product cannot use the OFF product ${code}: ${normalised.reason}`);
    return {
      ok: false,
      failure: error("upstream_error", "Open Food Facts returned a product that cannot be used."),
    };
  }
  const stored =
    (await storeProduct(service, code, normalised, fetched.product)) ??
    (await findCachedProduct(service, code));
  if (stored === null) {
    throw new Error(`The OFF product ${code} lost a write race and is not stored`);
  }
  return { ok: true, ...stored };
}

async function fetchOffProduct(code: string): Promise<{ ok: true; product: OffProduct } | Failed> {
  const result = await offRequest(`/api/v2/product/${code}`, {
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
    console.error(`off-product could not read the OFF answer for ${code}`, caught);
    return {
      ok: false,
      failure: error("upstream_error", "Open Food Facts answered in an unexpected form."),
    };
  }
  if (answer.status === 0) {
    return notFound();
  }
  if (answer.product === undefined) {
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

const uniqueViolation = "23505";

// PostgREST has no transaction, so the writes run in order: the food, its raw data, then the
// portions (the old ones deleted before the new ones go in). Returns null when the portions insert
// hits the one-default-portion index, which means another writer stored them first.
async function storeProduct(
  service: Service,
  code: string,
  normalised: NormalisedProduct,
  rawProduct: OffProduct,
): Promise<StoredProduct | null> {
  const { data: storedFood, error: foodError } = await service
    .from("foods")
    .upsert(
      {
        ...normalised.food,
        source: "off",
        source_ref: code,
        owner_id: null,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "source,source_ref" },
    )
    .select(foodColumns)
    .single();
  if (foodError !== null) {
    throw new Error(`Storing the food failed: ${foodError.message}`);
  }
  const food = toOffFood(storedFood);

  const { error: rawError } = await service
    .from("food_source_data")
    .upsert({ food_id: food.id, import_run_id: null, raw: rawProduct }, { onConflict: "food_id" });
  if (rawError !== null) {
    throw new Error(`Storing the raw OFF product failed: ${rawError.message}`);
  }

  const { error: deleteError } = await service
    .from("food_portions")
    .delete()
    .eq("food_id", food.id);
  if (deleteError !== null) {
    throw new Error(`Removing the old portions failed: ${deleteError.message}`);
  }
  if (normalised.portions.length === 0) {
    return { food, portions: [] };
  }
  const { data: portions, error: portionError } = await service
    .from("food_portions")
    .insert(
      normalised.portions.map((portion, position) => ({
        food_id: food.id,
        owner_id: null,
        label: portion.label,
        grams: portion.grams,
        ml: portion.ml,
        is_default: portion.isDefault,
        position,
      })),
    )
    .select(portionColumns)
    .order("position");
  if (portionError?.code === uniqueViolation) {
    return null;
  }
  if (portionError !== null) {
    throw new Error(`Storing the portions failed: ${portionError.message}`);
  }
  return { food, portions };
}

// Parsing with the contract schema means the function can never send a shape the client rejects.
function respond({ food, portions }: StoredProduct): Response {
  return json(offProductResponseSchema.parse({ food, portions }));
}
