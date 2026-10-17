import { buildRecipeLogEntry, recipeLogEntryInsertSchema } from "@keylow/core/diary";

import { ENTRY_COLUMNS, idOfRow, parseRow } from "./diaryRows";
import { recipeLogEntrySchema } from "./diarySchemas";
import { recipeRepoError } from "./recipes";

import type { RecipeLogEntry } from "./diarySchemas";
import type { Database } from "../database.types";
import type { BuildRecipeLogEntryInput } from "@keylow/core/diary";
import type { SupabaseClient } from "@supabase/supabase-js";

// A logged recipe is health data. Nothing here puts a recipe, an amount or a total in an error: a
// failed write names the action and the database's error code, and a check that fails before a
// request names the fields and never a value.

/** What a recipe is logged with: the recipe, an amount by serving or by grams of cooked weight, and when. See `buildRecipeLogEntry` in core. */
export type LogRecipeInput = BuildRecipeLogEntryInput;

const ACTION = "log the recipe";

/** A `RangeError` with the paths of the fields that failed. A Zod error is not attached, because its issues can quote the value. */
const invalidEntry = (paths: readonly string[]) =>
  new RangeError(
    `Could not ${ACTION}: the entry is not valid at ${[...new Set(paths)].join(", ")}`,
  );

/**
 * Builds the entry with core, and turns its `RangeError` into one that names the action only: the
 * amount is health data.
 */
function buildEntry(input: LogRecipeInput) {
  try {
    return buildRecipeLogEntry(input);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new RangeError(`Could not ${ACTION}: the amount or the recipe is not valid`);
    }
    throw error;
  }
}

/**
 * The built entry, checked against the insert schema. That catches a time or a day that is malformed,
 * since the builder stores both as given.
 */
function checkedEntry(input: LogRecipeInput) {
  const result = recipeLogEntryInsertSchema.safeParse(buildEntry(input));
  if (!result.success) {
    throw invalidEntry(result.error.issues.map(({ path }) => path.join(".") || "(entry)"));
  }
  return result.data;
}

/**
 * Logs an amount of a recipe: builds the entry with `buildRecipeLogEntry` (the recipe frozen from its
 * `computed` cache, the amount resolved to grams of cooked weight, the nutrients scaled from the
 * snapshot) and inserts it with `item_type` recipe, `recipe_id` set and no food. Resolves to the stored
 * row, whose `id` is what an Undo needs. The caller gives the time as an ISO instant and the calendar
 * day it falls on in the profile's time zone. Each call inserts its own row.
 *
 * The recipe is not read, so the entry holds the values of the recipe as the caller passed it. The
 * database refuses a recipe that is not the caller's, or does not exist, with the code 42501.
 *
 * Throws a `RangeError` before any request for a negative or too large amount, a unit that is not
 * `serving` or `g`, a recipe with no servings or no cooked weight, or a time or day that is malformed.
 */
export async function logRecipe(
  client: SupabaseClient<Database>,
  input: LogRecipeInput,
): Promise<RecipeLogEntry> {
  const { data, error } = await client
    .from("food_log_entries")
    .insert(checkedEntry(input))
    .select(ENTRY_COLUMNS)
    .single();

  if (error) {
    throw recipeRepoError(ACTION, error);
  }

  return parseRow(recipeLogEntrySchema, data, "read the new entry", idOfRow);
}
