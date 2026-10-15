import { toLocalDate } from "@keylow/core/dates";
import {
  buildLogEntry,
  buildQuickEntry,
  logEntryInsertSchema,
  recomputeEntry,
  refreshEntryFromFood,
} from "@keylow/core/diary";
import { z } from "zod";

import { ENTRY_COLUMNS, idOfRow, parseRow, repoError } from "./diaryRows";
import { foodLogEntrySchema, logEntrySchema, quickLogEntrySchema } from "./diarySchemas";
import { getFood, listFoodPortions } from "./foods";

import type { FoodLogEntry, LogEntry, QuickLogEntry } from "./diarySchemas";
import type { Database } from "../database.types";
import type {
  BuildLogEntryInput,
  BuildQuickEntryInput,
  EntryQuantityChange,
  LogEntryInsert,
} from "@keylow/core/diary";
import type { SupabaseClient } from "@supabase/supabase-js";

// These are health data. Nothing here puts a food, an amount or a note in an error: a failed write
// names the action, a row id and the field paths, never what the row held.

type EntryRow = Database["public"]["Tables"]["food_log_entries"]["Update"];

const INSTANT = z.iso.datetime({ offset: true });

/** What a food is logged with: the food, the amount, and when. See `buildLogEntry` in core. */
export type LogFoodInput = BuildLogEntryInput;

/** What a quick add is logged with: calories, optional macros and label, and when. See `buildQuickEntry` in core. */
export type LogQuickEntryInput = BuildQuickEntryInput;

/**
 * Runs a core builder and turns its `RangeError` into one that names the action only: core's
 * messages quote the quantity they were given, and that is health data.
 */
function build<Built>(action: string, builder: () => Built): Built {
  try {
    return builder();
  } catch (error) {
    if (error instanceof RangeError) {
      throw new RangeError(`Could not ${action}: the amount, the portion or the food is not valid`);
    }
    throw error;
  }
}

async function insertEntry<Schema extends z.ZodType<LogEntry>>(
  client: SupabaseClient<Database>,
  entry: LogEntryInsert,
  stored: Schema,
  action: string,
): Promise<z.output<Schema>> {
  // The builders store the time and the day as given, so a malformed one is caught here, before any request.
  parseRow(logEntryInsertSchema, entry, action, () => "(new)");

  // Narrow the union so each branch type-checks against the generated insert type.
  const table = client.from("food_log_entries");
  const { data, error } = await (
    entry.item_type === "food" ? table.insert(entry) : table.insert(entry)
  )
    .select(ENTRY_COLUMNS)
    .single();

  if (error) {
    throw repoError(action, error);
  }

  return parseRow(stored, data, "read the new entry", idOfRow);
}

/**
 * Logs a food: builds the entry with `buildLogEntry` (the frozen snapshot, the nutrients scaled
 * from it, the resolved grams) and inserts it. The caller gives the time as an ISO instant and the
 * calendar day it falls on in the profile's time zone, which `defaultLoggedAt` in core computes.
 * Resolves to the stored row, whose `id` and `local_date` are what an Undo needs. Each call inserts
 * its own row, so several can be in flight at once.
 *
 * Throws a `RangeError` for a negative quantity or a `portion` unit without a portion, before any request.
 */
export async function logFood(
  client: SupabaseClient<Database>,
  input: LogFoodInput,
): Promise<FoodLogEntry> {
  return insertEntry(
    client,
    build("log the food", () => buildLogEntry(input)),
    foodLogEntrySchema,
    "log the food",
  );
}

/** Logs a quick add (calories, optional macros and label) at a time. Resolves to the stored row. */
export async function logQuickEntry(
  client: SupabaseClient<Database>,
  input: LogQuickEntryInput,
): Promise<QuickLogEntry> {
  return insertEntry(client, buildQuickEntry(input), quickLogEntrySchema, "log the quick add");
}

async function setDeletedAt(
  client: SupabaseClient<Database>,
  id: string,
  deletedAt: string | null,
  action: string,
): Promise<void> {
  const { data, error } = await client
    .from("food_log_entries")
    .update({ deleted_at: deletedAt })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw repoError(action, error);
  }
  if (data === null) {
    throw new Error(`The entry ${id} was not found`);
  }
}

/**
 * Removes an entry from the diary by setting `deleted_at` to the current time, as the caller's
 * clock gives it. The row is kept so the removal can be undone with `restoreLogEntry`. Throws when
 * the entry is not visible to the caller.
 */
export function softDeleteLogEntry(client: SupabaseClient<Database>, id: string): Promise<void> {
  return setDeletedAt(client, id, new Date().toISOString(), "delete the entry");
}

/** Brings a deleted entry back by clearing `deleted_at` (the Undo of a delete). Throws when the entry is not visible to the caller. */
export function restoreLogEntry(client: SupabaseClient<Database>, id: string): Promise<void> {
  return setDeletedAt(client, id, null, "restore the entry");
}

/** A new time for an entry: an ISO instant with an offset, and the profile's IANA time zone that decides which day it is. */
export type EntryTimeChange = { loggedAt: string; timeZone: string };

/**
 * What to change on an entry. A food entry takes any of the three, at least one. A quick add has no
 * amount and no food, so it takes a time only (anything else is a compile error, and a
 * `RangeError` at run time for a caller that got past the types). When more than one is given they
 * apply in this order and are written together: the current food data first, then the amount (from
 * the refreshed snapshot), then the time.
 *
 * `entry` must be the latest row the diary returned (the cached one): an amount change rewrites the
 * snapshot and the nutrients from it, so a stale copy would write stale values back.
 */
export type EntryUpdate =
  | {
      entry: QuickLogEntry;
      time: EntryTimeChange;
      amount?: never;
      useCurrentFoodData?: never;
    }
  | {
      entry: FoodLogEntry;
      /** A new quantity, unit or portion, recomputed from the entry's own snapshot (never the live food). */
      amount?: EntryQuantityChange;
      /** "Update to current food data": rebuilds the snapshot from the food as it is now, keeping the amount. */
      useCurrentFoodData?: boolean;
      /** A new time. `local_date` is recomputed from it, so moving an entry across midnight moves it to the other day. */
      time?: EntryTimeChange;
    };

function timingColumns({ loggedAt, timeZone }: EntryTimeChange): EntryRow {
  if (!INSTANT.safeParse(loggedAt).success) {
    throw new RangeError("The time of an entry must be an ISO instant with an offset");
  }
  return { logged_at: loggedAt, local_date: toLocalDate(new Date(loggedAt), timeZone) };
}

function foodColumns(entry: FoodLogEntry): EntryRow {
  return {
    quantity: entry.quantity,
    unit: entry.unit,
    portion_id: entry.portion_id,
    resolved_grams: entry.resolved_grams,
    snapshot: entry.snapshot,
    nutrients: entry.nutrients,
  };
}

async function currentFoodColumns(
  client: SupabaseClient<Database>,
  { entry, amount, useCurrentFoodData }: EntryUpdate,
): Promise<EntryRow> {
  if (entry.item_type !== "food") {
    throw new RangeError("Only a food entry has an amount or a food to update");
  }

  let next = entry;
  if (useCurrentFoodData === true) {
    // Unfiltered on `deleted_at`: a food that was deleted after it was logged still resolves.
    const food = await getFood(client, entry.snapshot.ref);
    if (food === null) {
      throw new Error(`The food ${entry.snapshot.ref} of the entry ${entry.id} could not be read`);
    }
    const portions = await listFoodPortions(client, food.id);
    next = build("update the entry", () => refreshEntryFromFood(next, food, portions));
  }
  if (amount !== undefined) {
    const current = next;
    next = build("update the entry", () => recomputeEntry(current, amount));
  }
  return foodColumns(next);
}

/**
 * Changes a live entry and resolves to the stored row. Only the columns the change touches are
 * written. Throws a `RangeError` before any request for an empty change, a bad time, or an amount
 * or food change on a quick add, and an error when the entry is not visible to the caller or is
 * deleted.
 */
export async function updateLogEntry(
  client: SupabaseClient<Database>,
  update: EntryUpdate,
): Promise<LogEntry> {
  const { entry, amount, useCurrentFoodData, time } = update;
  const changesFood = amount !== undefined || useCurrentFoodData === true;
  if (!changesFood && time === undefined) {
    throw new RangeError("An entry update needs an amount, a time or the current food data");
  }

  // The pure parts first, so a bad time or a quick add fails before the food is read.
  const timing = time === undefined ? {} : timingColumns(time);
  const food = changesFood ? await currentFoodColumns(client, update) : {};

  const { data, error } = await client
    .from("food_log_entries")
    .update({ ...food, ...timing })
    .eq("id", entry.id)
    .is("deleted_at", null)
    .select(ENTRY_COLUMNS)
    .maybeSingle();

  if (error) {
    throw repoError("update the entry", error);
  }
  if (data === null) {
    throw new Error(`The entry ${entry.id} was not found`);
  }

  return parseRow(logEntrySchema, data, "read the updated entry", idOfRow);
}
