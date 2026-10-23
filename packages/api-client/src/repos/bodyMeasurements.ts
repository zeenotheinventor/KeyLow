import { bodyMeasurementSchema } from "./bodyMeasurementSchemas";
import { idOfRow, parseRow } from "./diaryRows";

import type { BodyMeasurement } from "./bodyMeasurementSchemas";
import type { Database } from "../database.types";
import type { BodyMeasurementInsert, BodyMeasurementKind } from "@keylow/core/weight";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

// A body measurement is health data: the value, the time and a Health sample id never reach a message.
// A failure here names the action and the error code only, and the cause holds the code and nothing
// else, because the database's own message and details can quote the row that failed.

const BODY_MEASUREMENT_COLUMNS = "id,kind,measured_at,local_date,tz,value,source";

/** The most rows PostgREST returns for one request (`max_rows` in `packages/db/supabase/config.toml`). */
const PAGE_SIZE = 1000;
const IMPORT_CHUNK_SIZE = 500;
const IMPORT_KEY = "user_id,kind,source,external_id";

const bodyMeasurementRepoError = (action: string, cause: PostgrestError) =>
  new Error(`Could not ${action} (${cause.code})`, { cause: { code: cause.code } });

/**
 * Every live measurement of one kind for the signed in user, newest first: `local_date`, then
 * `measured_at`, then `id`, all descending. The API returns at most 1,000 rows to a request, so the list
 * is read a page at a time until a page comes back short, and joined.
 */
export async function listBodyMeasurements(
  client: SupabaseClient<Database>,
  kind: BodyMeasurementKind,
): Promise<BodyMeasurement[]> {
  const measurements: BodyMeasurement[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from("body_measurements")
      .select(BODY_MEASUREMENT_COLUMNS)
      .eq("kind", kind)
      .is("deleted_at", null)
      .order("local_date", { ascending: false })
      .order("measured_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw bodyMeasurementRepoError("load your body measurements", error);
    }

    measurements.push(
      ...data.map((row) =>
        parseRow(bodyMeasurementSchema, row, "read the body measurements", idOfRow),
      ),
    );

    if (data.length < PAGE_SIZE) {
      return measurements;
    }
  }
}

/** How a bulk import went: the rows that were new, and the rows that were already there (or repeated). */
export type BodyMeasurementImportResult = { inserted: number; skipped: number };

/**
 * Imports Health body fat and lean mass readings (`mapHealthBodyFatSamples` and
 * `mapHealthLeanMassSamples` in core give the rows, and the two kinds may be mixed) for `userId`, 500 rows
 * to a request. Rows whose `(user_id, kind, source, external_id)` is already stored are ignored,
 * soft-deleted ones included, so an import can be run again and a deleted reading does not come back.
 * `inserted` is the number of rows the database returned and `skipped` is the rest. A request that fails
 * ends the import with an error that names the code only, and a run again picks up where it stopped.
 * Measurements are import only: there is no update and no delete here.
 */
export async function importBodyMeasurements(
  client: SupabaseClient<Database>,
  userId: string,
  rows: readonly BodyMeasurementInsert[],
): Promise<BodyMeasurementImportResult> {
  let inserted = 0;

  for (let start = 0; start < rows.length; start += IMPORT_CHUNK_SIZE) {
    const chunk = rows
      .slice(start, start + IMPORT_CHUNK_SIZE)
      .map((row) => ({ ...row, user_id: userId }));

    const { data, error } = await client
      .from("body_measurements")
      .upsert(chunk, { onConflict: IMPORT_KEY, ignoreDuplicates: true })
      .select("id");

    if (error) {
      throw bodyMeasurementRepoError("import the body measurements", error);
    }
    inserted += data.length;
  }

  return { inserted, skipped: rows.length - inserted };
}
