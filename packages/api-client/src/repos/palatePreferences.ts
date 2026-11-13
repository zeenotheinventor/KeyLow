import { foodRowSchema } from "@keylow/core/schemas";
import { z } from "zod";

import { idOfRow, parseRow } from "./diaryRows";
import { repoError } from "./repoError";

import type { Database } from "../database.types";
import type { PalateFood, PalateFoodStat, PalatePreference } from "@keylow/core";
import type { SupabaseClient } from "@supabase/supabase-js";

// A palate says what a person eats and avoids, and an allergy is special category data (ADR 0003,
// Amendment 22). The database's own message and details can quote a failing row, so a failure here
// names the action and the error code only, and the cause holds the code and nothing else. A row that
// does not parse is reported by its id and the paths of the fields that failed, never by a value.

const PREFERENCE_COLUMNS = "id,kind,food_id,recipe_id,label";

const STATS_COLUMNS = [
  "food_id",
  "recipe_id",
  "entry_count",
  "distinct_days",
  "first_local_date",
  "last_local_date",
  "median_resolved_grams",
  "before_eleven_count",
  "eleven_to_sixteen_count",
  "sixteen_or_later_count",
].join(",");

/** The longest label the database accepts, as its check counts it (characters, after no trimming). */
const LABEL_MAX_LENGTH = 100;

/** What Postgres raises when the unique index on a preference collides. */
const UNIQUE_VIOLATION_CODE = "23505";

/**
 * Whether a failed add was refused because the word is already on the person's list: the unique index
 * collided. A repo error keeps the code alone as its cause, and this reads it.
 */
export function isDuplicatePalatePreference(error: unknown): boolean {
  return (
    error instanceof Error &&
    typeof error.cause === "object" &&
    error.cause !== null &&
    "code" in error.cause &&
    error.cause.code === UNIQUE_VIOLATION_CODE
  );
}

/** The most ids one request names, so the address of a read stays far inside what a server accepts. */
const FOODS_PER_REQUEST = 100;

const palateFoodSchema = foodRowSchema.pick({
  id: true,
  name: true,
  source: true,
  food_group: true,
});

const labelSchema = z.string().trim().min(1).max(LABEL_MAX_LENGTH);

const preferenceRowSchema = z
  .object({
    id: z.guid(),
    kind: z.enum(["dislike", "allergy", "not_usual"]),
    food_id: z.guid().nullable(),
    recipe_id: z.guid().nullable(),
    label: z.string().nullable(),
  })
  .transform((row): PalatePreference => ({
    id: row.id,
    kind: row.kind,
    foodId: row.food_id,
    recipeId: row.recipe_id,
    label: row.label,
  }));

const loggedDaysRowSchema = z
  .object({ logged_days: z.number().int() })
  .transform((row) => row.logged_days);

const statsRowSchema = z
  .object({
    food_id: z.guid().nullable(),
    recipe_id: z.guid().nullable(),
    entry_count: z.number().int(),
    distinct_days: z.number().int(),
    first_local_date: z.string(),
    last_local_date: z.string(),
    median_resolved_grams: z.number().nullable(),
    before_eleven_count: z.number().int(),
    eleven_to_sixteen_count: z.number().int(),
    sixteen_or_later_count: z.number().int(),
  })
  .transform((row): PalateFoodStat => ({
    foodId: row.food_id,
    recipeId: row.recipe_id,
    entryCount: row.entry_count,
    distinctDays: row.distinct_days,
    firstLocalDate: row.first_local_date,
    lastLocalDate: row.last_local_date,
    medianResolvedGrams: row.median_resolved_grams,
    beforeElevenCount: row.before_eleven_count,
    elevenToSixteenCount: row.eleven_to_sixteen_count,
    sixteenOrLaterCount: row.sixteen_or_later_count,
  }));

// The palate types are core's, which reads them, so the repo and core cannot drift.
export type { PalateFoodStat, PalatePreference };

/** A dislike or an allergy, named by a word that core matches against food names. */
export type PalateStatement = { kind: "dislike" | "allergy"; label: string };

/** What a "not true" correction is about: one food, one recipe or one label of the profile. */
export type NotUsualTarget = { foodId: string } | { recipeId: string } | { label: string };

/**
 * The signed in user's stated dislikes and allergies and their corrections, oldest first. Row level
 * security shows a user their own rows only, so no owner is passed.
 */
export async function listPalatePreferences(
  client: SupabaseClient<Database>,
): Promise<PalatePreference[]> {
  const action = "load your palate preferences";
  const { data, error } = await client
    .from("palate_preferences")
    .select(PREFERENCE_COLUMNS)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw repoError(action, error);
  }

  return data.map((row) => parseRow(preferenceRowSchema, row, action, idOfRow));
}

type PreferenceInsert = Database["public"]["Tables"]["palate_preferences"]["Insert"];

const insertPreference = async (client: SupabaseClient<Database>, row: PreferenceInsert) => {
  const { data, error } = await client
    .from("palate_preferences")
    .insert(row)
    .select(PREFERENCE_COLUMNS)
    .single();
  return { data, error };
};

/**
 * Adds a stated dislike or allergy and resolves to the row as stored. The label is trimmed and
 * checked first, so nothing invalid is sent. Adding the same word twice under one kind fails with the
 * code `23505`.
 */
export async function addPalatePreference(
  client: SupabaseClient<Database>,
  statement: PalateStatement,
): Promise<PalatePreference> {
  const action = "add to your palate";
  const label = labelSchema.safeParse(statement.label);
  if (!label.success) {
    throw repoError(action, { code: "invalid" });
  }

  const { data, error } = await insertPreference(client, {
    kind: statement.kind,
    label: label.data,
  });

  if (error) {
    throw repoError(action, error);
  }

  return parseRow(preferenceRowSchema, data, action, idOfRow);
}

/**
 * Records the "not true" correction on one item of the person's profile. Saying it twice is saying it
 * once, so a correction that is already stored resolves like a new one. To take it back, remove the
 * row by its id.
 */
export async function setNotUsual(
  client: SupabaseClient<Database>,
  target: NotUsualTarget,
): Promise<void> {
  const action = "mark this as not usual";
  let row: PreferenceInsert;
  if ("foodId" in target) {
    row = { kind: "not_usual", food_id: target.foodId };
  } else if ("recipeId" in target) {
    row = { kind: "not_usual", recipe_id: target.recipeId };
  } else {
    const label = labelSchema.safeParse(target.label);
    if (!label.success) {
      throw repoError(action, { code: "invalid" });
    }
    row = { kind: "not_usual", label: label.data };
  }

  const { error } = await insertPreference(client, row);

  if (error && error.code !== UNIQUE_VIOLATION_CODE) {
    throw repoError(action, error);
  }
}

/** Removes one row from the palate. A row that is not the user's is left alone. */
export async function removePalatePreference(
  client: SupabaseClient<Database>,
  id: string,
): Promise<void> {
  const { error } = await client.from("palate_preferences").delete().eq("id", id);

  if (error) {
    throw repoError("remove this from your palate", error);
  }
}

/**
 * What the signed in user eats most, from the `palate_food_stats` view: one row per food or recipe in
 * the last 90 days, the most logged first, then the most recent. The view runs with the caller's
 * rights, so a user reads their own figures only.
 */
export async function listPalateStats(client: SupabaseClient<Database>): Promise<PalateFoodStat[]> {
  const action = "load what you eat most";
  const { data, error } = await client
    .from("palate_food_stats")
    .select(STATS_COLUMNS)
    .order("entry_count", { ascending: false })
    .order("last_local_date", { ascending: false })
    .order("food_id", { ascending: true, nullsFirst: false })
    .order("recipe_id", { ascending: true, nullsFirst: false });

  if (error) {
    throw repoError(action, error);
  }

  return data.map((row) => parseRow(statsRowSchema, row, action, () => "(view row)"));
}

/**
 * How many days in the last 90 have anything logged, from the `palate_logged_days` view, which counts
 * quick entries too. Core needs it beside the stats to say how often a food comes up. The view has no
 * row for a person with nothing logged, and that reads as 0.
 */
export async function getPalateLoggedDays(client: SupabaseClient<Database>): Promise<number> {
  const action = "load your logged days";
  const { data, error } = await client
    .from("palate_logged_days")
    .select("logged_days")
    .maybeSingle();

  if (error) {
    throw repoError(action, error);
  }

  return data === null ? 0 : parseRow(loggedDaysRowSchema, data, action, () => "(view row)");
}

/**
 * The columns of the palate's foods that core reads (name, source and food group), for the ids asked
 * for. A deleted food is returned too, because an old entry still points at it. An id the user cannot
 * see is left out, and the order of the answer is not the order of the ids.
 */
export async function listPalateFoods(
  client: SupabaseClient<Database>,
  foodIds: readonly string[],
): Promise<PalateFood[]> {
  const action = "load the foods in your palate";
  const readIds = async (ids: readonly string[]): Promise<PalateFood[]> => {
    const { data, error } = await client
      .from("foods")
      .select("id,name,source,food_group")
      .in("id", [...ids]);

    if (error) {
      throw repoError(action, error);
    }

    return data.map((row) => parseRow(palateFoodSchema, row, action, idOfRow));
  };

  const requests: Promise<PalateFood[]>[] = [];
  for (let first = 0; first < foodIds.length; first += FOODS_PER_REQUEST) {
    requests.push(readIds(foodIds.slice(first, first + FOODS_PER_REQUEST)));
  }
  return (await Promise.all(requests)).flat();
}
