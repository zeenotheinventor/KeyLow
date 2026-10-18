import { idOfRow, parseRow } from "./diaryRows";
import { weighInSchema } from "./weighInSchemas";

import type { WeighIn } from "./weighInSchemas";
import type { Database } from "../database.types";
import type { HealthWeighInInsert, ManualWeighInInsert } from "@keylow/core/weight";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

// A weigh-in is health data: the weight, the note and a Health sample id never reach a message. A
// failure here names the action and the error code only, and the cause holds the code and nothing else,
// because the database's own message and details can quote the row that failed.

const WEIGH_IN_COLUMNS = "id,measured_at,local_date,tz,weight_kg,source,note";

/** The most rows PostgREST returns for one request (`max_rows` in `packages/db/supabase/config.toml`). */
const PAGE_SIZE = 1000;
const IMPORT_CHUNK_SIZE = 500;
const IMPORT_KEY = "user_id,source,external_id";

const weighInRepoError = (action: string, cause: PostgrestError) =>
  new Error(`Could not ${action} (${cause.code})`, { cause: { code: cause.code } });

/** Thrown when an update finds no manual row to change: the row is imported, deleted or not the caller's. */
export class WeighInNotEditableError extends Error {
  constructor() {
    super("Could not update the weigh-in: it is not editable");
    this.name = "WeighInNotEditableError";
  }
}

/**
 * Every live weigh-in of the signed in user, newest first: `local_date`, then `measured_at`, then `id`,
 * all descending. The API returns at most 1,000 rows to a request, so the list is read a page at a time
 * until a page comes back short, and joined.
 */
export async function listWeighIns(client: SupabaseClient<Database>): Promise<WeighIn[]> {
  const weighIns: WeighIn[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from("weigh_ins")
      .select(WEIGH_IN_COLUMNS)
      .is("deleted_at", null)
      .order("local_date", { ascending: false })
      .order("measured_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw weighInRepoError("load your weigh-ins", error);
    }

    weighIns.push(
      ...data.map((row) => parseRow(weighInSchema, row, "read the weigh-ins", idOfRow)),
    );

    if (data.length < PAGE_SIZE) {
      return weighIns;
    }
  }
}

/**
 * Adds a manual weigh-in for the signed in user (the database fills in `user_id`). The row comes from
 * `buildManualWeighIn` in core, which checks the weight and the note. Resolves to the stored row.
 */
export async function addWeighIn(
  client: SupabaseClient<Database>,
  input: ManualWeighInInsert,
): Promise<WeighIn> {
  const { data, error } = await client
    .from("weigh_ins")
    .insert(input)
    .select(WEIGH_IN_COLUMNS)
    .single();

  if (error) {
    throw weighInRepoError("add the weigh-in", error);
  }

  return parseRow(weighInSchema, data, "read the new weigh-in", idOfRow);
}

/**
 * What to change on a manual weigh-in. Give the three time columns together when the time changes
 * (`measured_at`, `local_date` and `tz`, which `buildManualWeighIn` in core computes), and none of them
 * for an edit of the value or the note, so they stay in agreement.
 */
export type WeighInChange = Partial<
  Pick<ManualWeighInInsert, "weight_kg" | "measured_at" | "local_date" | "tz" | "note">
>;

/**
 * Changes a live manual weigh-in and resolves to the stored row. An imported weigh-in is delete only
 * (Amendment 9 to ADR 0003), and the database cannot tell the rows apart, so this updates `source =
 * 'manual'` rows only. Throws a `WeighInNotEditableError` when no such row matches, and a `RangeError`
 * before any request for an empty change.
 */
export async function updateWeighIn(
  client: SupabaseClient<Database>,
  id: string,
  change: WeighInChange,
): Promise<WeighIn> {
  if (Object.keys(change).length === 0) {
    throw new RangeError("A weigh-in update needs at least one change");
  }

  const { data, error } = await client
    .from("weigh_ins")
    .update(change)
    .eq("id", id)
    .eq("source", "manual")
    .is("deleted_at", null)
    .select(WEIGH_IN_COLUMNS)
    .maybeSingle();

  if (error) {
    throw weighInRepoError("update the weigh-in", error);
  }
  if (data === null) {
    throw new WeighInNotEditableError();
  }

  return parseRow(weighInSchema, data, "read the updated weigh-in", idOfRow);
}

/**
 * Removes a weigh-in of any source from the list by setting `deleted_at`. The row is kept for good,
 * because it holds the import key, so a deleted import is skipped by the next import and never comes
 * back. There is no hard delete. Throws when the weigh-in is not there, already deleted or not the caller's.
 */
export async function softDeleteWeighIn(
  client: SupabaseClient<Database>,
  id: string,
): Promise<void> {
  const { data, error } = await client
    .from("weigh_ins")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw weighInRepoError("delete the weigh-in", error);
  }
  if (data === null) {
    throw new Error("Could not delete the weigh-in: it was not found");
  }
}

/** How a bulk import went: the rows that were new, and the rows that were already there (or repeated). */
export type ImportResult = { inserted: number; skipped: number };

/**
 * Imports Health weigh-ins (`mapHealthSamples` in core gives the rows) for `userId`, 500 rows to a
 * request. Rows whose `(user_id, source, external_id)` is already stored are ignored, soft-deleted
 * ones included, so an import can be run again and a deleted reading does not come back. `inserted`
 * is the number of rows the database returned and `skipped` is the rest. A request that fails ends the
 * import with an error that names the code only, and a run again picks up where it stopped.
 */
export async function importWeighIns(
  client: SupabaseClient<Database>,
  userId: string,
  rows: readonly HealthWeighInInsert[],
): Promise<ImportResult> {
  let inserted = 0;

  for (let start = 0; start < rows.length; start += IMPORT_CHUNK_SIZE) {
    const chunk = rows
      .slice(start, start + IMPORT_CHUNK_SIZE)
      .map((row) => ({ ...row, user_id: userId }));

    const { data, error } = await client
      .from("weigh_ins")
      .upsert(chunk, { onConflict: IMPORT_KEY, ignoreDuplicates: true })
      .select("id");

    if (error) {
      throw weighInRepoError("import the weigh-ins", error);
    }
    inserted += data.length;
  }

  return { inserted, skipped: rows.length - inserted };
}
