import { foodPortionSchema, foodRowSchema } from "@keylow/core/schemas";
import { z } from "zod";

import type { Database } from "../database.types";
import type { CustomFoodInput, Food, FoodPortion } from "@keylow/core/schemas";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

type FoodInsert = Database["public"]["Tables"]["foods"]["Insert"];
type FoodPortionInsert = Database["public"]["Tables"]["food_portions"]["Insert"];

// The generated `search` column is a database-only tsvector, so it is never selected.
const FOOD_COLUMNS = Object.keys(foodRowSchema.shape).join(",");

// Every `search_foods` column is typed non-null in the generated types, which is wrong for barcode,
// brand, deleted_at and others, so rows are parsed instead of trusted.
const foodSearchHitSchema = foodRowSchema.extend({ score: z.number() });

/** A food row with the relevance score the `search_foods` RPC ranked it by. */
export type FoodSearchHit = z.infer<typeof foodSearchHitSchema>;

// A barcode can sit on a few rows (the caller's own food and the shared ones), so a few are fetched
// and the caller's own is picked. More than this would mean the same code on a crowd of rows.
const BARCODE_LOOKUP_LIMIT = 5;

// The "Your foods" list is bounded so a user with a great many foods cannot make one huge request.
const DEFAULT_OWN_FOODS_LIMIT = 200;

const MIN_SEARCH_LENGTH = 2;
const DEFAULT_SEARCH_LIMIT = 25;
const MAX_SEARCH_LIMIT = 50;

const repoError = (action: string, cause: PostgrestError) =>
  new Error(`Could not ${action}: ${cause.message}`, { cause });

/**
 * Thrown when a write stopped half way and left the food and its portions out of step: the food
 * row was written but its portions were not. Callers should refresh what they cache for `foodId`,
 * because the database no longer matches what they last read.
 */
export class FoodsPartialWriteError extends Error {
  readonly foodId: string;
  readonly stage = "portions";

  constructor(foodId: string, message: string, cause: unknown) {
    super(message, { cause });
    this.name = "FoodsPartialWriteError";
    this.foodId = foodId;
  }
}

/** A food and the portions the database stored for it. */
export type CreatedFood = { food: Food; portions: FoodPortion[] };

/**
 * The columns a user may write, built from the validated form input. Optional values the
 * input leaves out become null so that editing a food can clear them. `quality`, `source_ref`
 * and `fetched_at` are never written because the database role has no grant on them.
 * `sat_fat_g`, `sugars_g`, `salt_g`, `food_group` and `micros` are not part of the form, so
 * an update intentionally leaves them untouched.
 */
const editableColumns = (input: CustomFoodInput): Omit<FoodInsert, "source" | "owner_id"> => ({
  name: input.name,
  brand: input.brand ?? null,
  barcode: input.barcode ?? null,
  basis: input.basis,
  density_g_per_ml: input.density_g_per_ml ?? null,
  kcal: input.kcal,
  protein_g: input.protein_g,
  fat_g: input.fat_g,
  carbs_g: input.carbs_g,
  fibre_g: input.fibre_g ?? null,
});

const portionRows = (
  foodId: string,
  ownerId: string,
  portions: CustomFoodInput["portions"],
): FoodPortionInsert[] =>
  portions.map((portion, position) => ({
    owner_id: ownerId,
    food_id: foodId,
    label: portion.label,
    grams: portion.grams ?? null,
    ml: portion.ml ?? null,
    is_default: portion.isDefault,
    position,
  }));

export async function getFood(client: SupabaseClient<Database>, id: string): Promise<Food | null> {
  const { data, error } = await client
    .from("foods")
    .select(FOOD_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw repoError("load the food", error);
  }

  return data === null ? null : foodRowSchema.parse(data);
}

/**
 * Finds the food the caller can see that has this barcode, which must already be in canonical form
 * (see `normaliseBarcode`). Deleted foods are ignored. When the caller's own food and a shared one
 * carry the same barcode, the caller's own wins. Resolves to null when no food has it.
 */
export async function getFoodByBarcode(
  client: SupabaseClient<Database>,
  code: string,
): Promise<Food | null> {
  const { data, error } = await client
    .from("foods")
    .select(FOOD_COLUMNS)
    .eq("barcode", code)
    .is("deleted_at", null)
    // Row level security only shows the caller their own rows and the shared ones (no owner).
    // So a row with an owner is the caller's own, and nulls last puts the shared rows behind it.
    .order("owner_id", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(BARCODE_LOOKUP_LIMIT);

  if (error) {
    throw repoError("look up the food by barcode", error);
  }

  const foods = data.map((row) => foodRowSchema.parse(row));

  return foods.find((food) => food.owner_id !== null) ?? foods[0] ?? null;
}

/**
 * Lists the caller's own foods by name, without a query, for the "Your foods" screen. Deleted foods
 * are left out. At most `limit` foods are returned, 200 unless told otherwise. `search_foods` cannot
 * do this because it answers nothing for a query under 2 characters.
 */
export async function listOwnFoods(
  client: SupabaseClient<Database>,
  { limit = DEFAULT_OWN_FOODS_LIMIT }: { limit?: number } = {},
): Promise<Food[]> {
  const { data, error } = await client
    .from("foods")
    .select(FOOD_COLUMNS)
    // Row level security only shows the caller their own rows and the shared ones (no owner).
    // So a row with an owner is the caller's own, the same reasoning `getFoodByBarcode` relies on.
    .not("owner_id", "is", null)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw repoError("list your foods", error);
  }

  return data.map((row) => foodRowSchema.parse(row));
}

export async function listFoodPortions(
  client: SupabaseClient<Database>,
  foodId: string,
): Promise<FoodPortion[]> {
  const { data, error } = await client
    .from("food_portions")
    .select("*")
    .eq("food_id", foodId)
    .order("position", { ascending: true });

  if (error) {
    throw repoError("load the food's portions", error);
  }

  return data.map((row) => foodPortionSchema.parse(row));
}

/**
 * Replaces a food's portions by deleting its rows and inserting the new ones, which is the
 * pattern the schema grants allow. The two steps are not atomic: if the insert fails after the
 * delete, the old portions are gone and a `FoodsPartialWriteError` says so.
 *
 * Called directly on a food the caller cannot edit, it deletes nothing and returns [] for an
 * empty list, because RLS filters the delete silently. That is why `updateFood` writes the food
 * first and only then replaces its portions.
 */
export async function replaceFoodPortions(
  client: SupabaseClient<Database>,
  foodId: string,
  ownerId: string,
  portions: CustomFoodInput["portions"],
): Promise<FoodPortion[]> {
  const { error: deleteError } = await client.from("food_portions").delete().eq("food_id", foodId);

  if (deleteError) {
    throw new Error(
      `Could not remove the old portions of the food ${foodId}: ${deleteError.message}`,
      { cause: deleteError },
    );
  }

  if (portions.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("food_portions")
    .insert(portionRows(foodId, ownerId, portions))
    .select("*")
    .order("position", { ascending: true });

  if (error) {
    throw new FoodsPartialWriteError(
      foodId,
      `The old portions of the food ${foodId} were removed but the new portions were not saved: ${error.message}`,
      error,
    );
  }

  return data.map((row) => foodPortionSchema.parse(row));
}

/**
 * Creates a custom food and then its portions. There is no delete grant on `foods`, so when the
 * portions insert fails the food cannot be rolled back, and a `FoodsPartialWriteError` says so.
 */
export async function createFood(
  client: SupabaseClient<Database>,
  ownerId: string,
  input: CustomFoodInput,
): Promise<CreatedFood> {
  const { data, error } = await client
    .from("foods")
    .insert({ ...editableColumns(input), source: "user", owner_id: ownerId, micros: {} })
    .select(FOOD_COLUMNS)
    .single();

  if (error) {
    throw repoError("create the food", error);
  }

  const food = foodRowSchema.parse(data);

  if (input.portions.length === 0) {
    return { food, portions: [] };
  }

  const { data: portionData, error: portionsError } = await client
    .from("food_portions")
    .insert(portionRows(food.id, ownerId, input.portions))
    .select("*")
    .order("position", { ascending: true });

  if (portionsError) {
    throw new FoodsPartialWriteError(
      food.id,
      `The food ${food.id} was created but its portions were not saved: ${portionsError.message}`,
      portionsError,
    );
  }

  return { food, portions: portionData.map((row) => foodPortionSchema.parse(row)) };
}

/**
 * Updates a custom food's columns and then replaces its portions. Throws when the food is not
 * visible to the caller or is not theirs to edit, before touching the portions. If replacing the
 * portions fails, the food stays updated and a `FoodsPartialWriteError` says so.
 */
export async function updateFood(
  client: SupabaseClient<Database>,
  id: string,
  input: CustomFoodInput,
): Promise<Food> {
  const { data, error } = await client
    .from("foods")
    .update(editableColumns(input))
    .eq("id", id)
    .select(FOOD_COLUMNS)
    .maybeSingle();

  if (error) {
    throw repoError("update the food", error);
  }

  if (data === null) {
    throw new Error(`The food ${id} was not found or cannot be edited`);
  }

  const food = foodRowSchema.parse(data);

  if (food.owner_id === null) {
    throw new Error(`The food ${id} is not a custom food`);
  }

  try {
    await replaceFoodPortions(client, id, food.owner_id, input.portions);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new FoodsPartialWriteError(
      id,
      `The food ${id} was updated but its portions were not replaced. ${detail}`,
      cause,
    );
  }

  return food;
}

/**
 * Searches the foods the caller can see through the `search_foods` RPC, best match first. A query
 * shorter than 2 characters once trimmed returns [] without a request. `limit` is clamped to
 * 1..50, as the RPC does too. A row that does not parse throws rather than being dropped.
 */
export async function searchFoods(
  client: SupabaseClient<Database>,
  query: string,
  limit = DEFAULT_SEARCH_LIMIT,
): Promise<FoodSearchHit[]> {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < MIN_SEARCH_LENGTH) {
    return [];
  }

  const { data, error } = await client.rpc("search_foods", {
    q: trimmedQuery,
    lim: Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.trunc(limit))),
  });

  if (error) {
    throw repoError("search the foods", error);
  }

  // The RPC already orders its rows. Sorting again is defensive, and stable for equal rows.
  return data
    .map((row) => foodSearchHitSchema.parse(row))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
