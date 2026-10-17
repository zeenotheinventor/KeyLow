import type { DiaryInsert } from "./diarySchemas";
import type { Database } from "../database.types";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

// The diary holds health data. Nothing in these helpers puts a value of an entry, a note or a total
// in an error: a failure names the action, a row id and the field paths, never what the row held.

/** The `food_log_entries` columns a diary read returns. `user_id` and `deleted_at` are left out. */
export const ENTRY_COLUMNS = [
  "id",
  "local_date",
  "logged_at",
  "created_at",
  "item_type",
  "food_id",
  "quantity",
  "unit",
  "portion_id",
  "resolved_grams",
  "snapshot",
  "nutrients",
  "kcal",
  "recipe_id",
].join(",");

/**
 * Starts the insert of an entry of any kind. Each case narrows the union so it type-checks against the
 * generated insert type, and all three give the same builder, so the caller chains its own `select`.
 */
export function insertDiaryEntry(client: SupabaseClient<Database>, entry: DiaryInsert) {
  const table = client.from("food_log_entries");
  switch (entry.item_type) {
    case "food":
      return table.insert(entry);
    case "quick":
      return table.insert(entry);
    case "recipe":
      return table.insert(entry);
  }
}

export const repoError = (action: string, cause: PostgrestError) =>
  new Error(`Could not ${action}: ${cause.message}`, { cause });

/**
 * Parses what the database returned, and on failure reports where the row is wrong. The message
 * has the row id and the failing field paths only, and the Zod error is not attached as the cause,
 * because its issues can quote the value that failed.
 */
export function parseRow<Schema extends z.ZodType>(
  schema: Schema,
  row: unknown,
  action: string,
  idOf: (row: unknown) => string,
): z.output<Schema> {
  const result = schema.safeParse(row);
  if (result.success) {
    return result.data;
  }
  const paths = result.error.issues.map((issue) => issue.path.join(".") || "(row)");
  throw new Error(
    `Could not ${action}: row ${idOf(row)} has an unexpected shape at ${paths.join(", ")}`,
  );
}

export const idOfRow = (row: unknown): string =>
  typeof row === "object" && row !== null && "id" in row && typeof row.id === "string"
    ? row.id
    : "(unknown)";

export const dateOfRow = (row: unknown): string =>
  typeof row === "object" &&
  row !== null &&
  "local_date" in row &&
  typeof row.local_date === "string"
    ? row.local_date
    : "(unknown)";
