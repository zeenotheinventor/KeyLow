import { toLocalDate } from "@keylow/core/dates";
import {
  buildLogEntry,
  buildQuickEntry,
  buildRecipeLogEntry,
  quickLogEntryInsertSchema,
  recomputeEntry,
  recomputeRecipeEntry,
  refreshEntryFromFood,
} from "@keylow/core/diary";
import { z } from "zod";

import { isDeadPortionRefusal, writeWithoutDeadPortion } from "./deadPortion";
import { ENTRY_COLUMNS, idOfRow, insertDiaryEntry, parseRow, repoError } from "./diaryRows";
import {
  diaryInsertSchema,
  foodLogEntrySchema,
  logEntrySchema,
  quickLogEntrySchema,
  recipeLogEntrySchema,
} from "./diarySchemas";
import { getFood, listFoodPortions } from "./foods";
import { recipeRepoError } from "./recipes";

import type {
  DiaryInsert,
  FoodLogEntry,
  LogEntry,
  QuickLogEntry,
  RecipeLogEntry,
} from "./diarySchemas";
import type { LogRecipeInput } from "./recipeEntries";
import type { Database } from "../database.types";
import type {
  BuildLogEntryInput,
  BuildQuickEntryInput,
  EntryQuantityChange,
  RecipeAmount,
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

const portionIdOf = (entry: DiaryInsert) => (entry.item_type === "food" ? entry.portion_id : null);

/** The entry with another portion. Only a food entry has one, so the others are returned as they are. */
const withPortionId = (entry: DiaryInsert, portionId: string | null): DiaryInsert =>
  entry.item_type === "food" ? { ...entry, portion_id: portionId } : entry;

async function insertEntry<Schema extends z.ZodType<LogEntry>>(
  client: SupabaseClient<Database>,
  entry: DiaryInsert,
  stored: Schema,
  action: string,
): Promise<z.output<Schema>> {
  // The builders store the time and the day as given, so a malformed one is caught here, before any request.
  parseRow(diaryInsertSchema, entry, action, () => "(new)");

  const { data, error } = await writeWithoutDeadPortion(portionIdOf(entry), (portionId) =>
    insertDiaryEntry(client, withPortionId(entry, portionId)).select(ENTRY_COLUMNS).single(),
  );

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

/** One thing on the plate: a food or a recipe serving, with what `logFood` or `logRecipe` takes. */
export type LogEntriesItem =
  { kind: "food"; input: LogFoodInput } | { kind: "recipe"; input: LogRecipeInput };

const LOG_ENTRIES_ACTION = "log the entries";

/** Builds the row of one item and checks it, naming the action and the field paths, never a value. */
function checkedItemEntry(item: LogEntriesItem): DiaryInsert {
  const entry = build(LOG_ENTRIES_ACTION, () =>
    item.kind === "food" ? buildLogEntry(item.input) : buildRecipeLogEntry(item.input),
  );
  // The builders store the time and the day as given, so a malformed one is caught here, before any request.
  const checked = diaryInsertSchema.safeParse(entry);
  if (!checked.success) {
    const paths = checked.error.issues.map(({ path }) => path.join(".") || "(entry)");
    throw new RangeError(
      `Could not ${LOG_ENTRIES_ACTION}: the entry is not valid at ${[...new Set(paths)].join(", ")}`,
    );
  }
  return checked.data;
}

/** The entries with no portion on the food rows whose portion is in `deadPortionIds`. */
const withoutPortions = (entries: readonly DiaryInsert[], deadPortionIds: ReadonlySet<string>) =>
  entries.map((entry) => {
    const portionId = portionIdOf(entry);
    return portionId !== null && deadPortionIds.has(portionId) ? withPortionId(entry, null) : entry;
  });

/**
 * The ids among the portions of the batch that no longer exist, or an empty set when there is nothing
 * to look up or the portions could not be read (the first refusal is then what the caller reports).
 */
async function deadPortionIdsOf(
  client: SupabaseClient<Database>,
  entries: readonly DiaryInsert[],
): Promise<Set<string>> {
  const portionIds = [...new Set(entries.flatMap((entry) => portionIdOf(entry) ?? []))];
  if (portionIds.length === 0) {
    return new Set();
  }

  const { data, error } = await client.from("food_portions").select("id").in("id", portionIds);
  if (error) {
    return new Set();
  }

  const livePortionIds = new Set(data.map(({ id }) => id));
  return new Set(portionIds.filter((portionId) => !livePortionIds.has(portionId)));
}

/**
 * Logs everything on the plate in one request, all or nothing: the rows are built with `buildLogEntry`
 * and `buildRecipeLogEntry`, each is checked before any request, and they go into `food_log_entries` as
 * one array insert. PostgREST runs that as a single `INSERT` statement in one transaction, so a row the
 * database refuses stores none of them, and the row level security policy still runs for each row.
 * Resolves to the stored rows in the order given. A food may appear twice, and foods and recipes mix.
 *
 * The diary sorts by `logged_at`, then `created_at`, then `id`, and one statement gives every row the
 * same `created_at`. So the i-th row is logged i milliseconds after the time it was given: the clock
 * time shown is the same, and the order of the plate is the order of the diary.
 *
 * When the database refuses the batch for a portion that is gone (a refresh of a branded food replaces
 * its portions), the portions of the batch are listed once, the food rows whose portion is gone lose
 * it (their snapshot keeps the label and the amount), and the whole batch is sent once more. Any other
 * refusal, and a second one, throws an error that names the action and the code.
 *
 * Throws a `RangeError` before any request for an empty list, or for a row with a negative or too large
 * amount, a portion unit without a portion, or a time or day that is malformed.
 */
export async function logEntries(
  client: SupabaseClient<Database>,
  items: readonly LogEntriesItem[],
): Promise<(FoodLogEntry | RecipeLogEntry)[]> {
  if (items.length === 0) {
    throw new RangeError(`Could not ${LOG_ENTRIES_ACTION}: there is nothing to log`);
  }

  const entries = items.map((item, index) => {
    const entry = checkedItemEntry(item);
    return index === 0
      ? entry
      : { ...entry, logged_at: new Date(Date.parse(entry.logged_at) + index).toISOString() };
  });

  const insertAll = (rows: readonly DiaryInsert[]) =>
    client
      .from("food_log_entries")
      .insert([...rows])
      .select(ENTRY_COLUMNS);

  let result = await insertAll(entries);
  if (result.error && isDeadPortionRefusal(result.error)) {
    const deadPortionIds = await deadPortionIdsOf(client, entries);
    if (deadPortionIds.size > 0) {
      result = await insertAll(withoutPortions(entries, deadPortionIds));
    }
  }

  const { data, error } = result;
  if (error) {
    throw recipeRepoError(LOG_ENTRIES_ACTION, error);
  }
  if (data.length !== items.length) {
    throw new Error(
      `Could not ${LOG_ENTRIES_ACTION}: the database stored a different number of rows`,
    );
  }

  return items.map((item, index) =>
    parseRow(
      item.kind === "food" ? foodLogEntrySchema : recipeLogEntrySchema,
      data[index],
      "read the new entries",
      idOfRow,
    ),
  );
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

/** New values for a quick add: its calories, macros (null for one that is not given) and label (null for none). */
export type QuickEntryValues = {
  kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  label: string | null;
};

/**
 * What to change on an entry. A food entry takes any of three, at least one: an amount, the current
 * food data, a time. A quick add has no amount and no food, so it takes new values, a time, or both.
 * A recipe entry takes an amount (a number of servings or grams of cooked weight), a time, or both:
 * it has no "current recipe data" to update to (anything else is a compile error, and a `RangeError`
 * at run time for a caller that got past the types). When more than one is given they apply in this order and are written together: the current
 * food data first, then the amount (from the refreshed snapshot), then the time.
 *
 * `entry` must be the latest row the diary returned (the cached one): an amount change rewrites the
 * snapshot and the nutrients from it, so a stale copy would write stale values back. A recipe entry's
 * amount is rebuilt by `recomputeRecipeEntry` in core from that snapshot alone, so editing or archiving
 * the recipe afterwards changes nothing about the entry.
 */
export type EntryUpdate =
  | {
      entry: QuickLogEntry;
      /** New calories, macros and label. Written as the whole `nutrients` object and `snapshot`, as a new quick add stores them. */
      quick?: QuickEntryValues;
      time?: EntryTimeChange;
      amount?: never;
      useCurrentFoodData?: never;
    }
  | {
      entry: RecipeLogEntry;
      /** A new number of servings or grams of cooked weight, recomputed from the entry's own snapshot (never the live recipe). */
      amount?: RecipeAmount;
      /** A new time. `local_date` is recomputed from it. */
      time?: EntryTimeChange;
      quick?: never;
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
      quick?: never;
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

/**
 * The columns a quick add's new values change: its nutrients and its snapshot (which holds the label),
 * built by the same function that builds a new quick add so the two cannot drift. The calories column
 * is generated from the nutrients and is never written.
 */
function quickColumns(entry: QuickLogEntry, quick: QuickEntryValues): EntryRow {
  const built = build("update the entry", () =>
    buildQuickEntry({
      localDate: entry.local_date,
      loggedAt: entry.logged_at,
      kcal: quick.kcal,
      ...(quick.protein_g === null ? {} : { protein_g: quick.protein_g }),
      ...(quick.fat_g === null ? {} : { fat_g: quick.fat_g }),
      ...(quick.carbs_g === null ? {} : { carbs_g: quick.carbs_g }),
      ...(quick.label === null ? {} : { label: quick.label }),
    }),
  );
  if (!quickLogEntryInsertSchema.safeParse(built).success) {
    throw new RangeError("Could not update the entry: the values of a quick add are not valid");
  }

  return { nutrients: built.nutrients, snapshot: built.snapshot };
}

type RecipeEntryUpdate = Extract<EntryUpdate, { entry: RecipeLogEntry }>;

const isRecipeUpdate = (update: EntryUpdate): update is RecipeEntryUpdate =>
  update.entry.item_type === "recipe";

/**
 * A recipe entry's new amount: the columns that depend on the snapshot, rebuilt from the entry's own
 * snapshot by core. The recipe is never read, so a recipe edited or archived since changes nothing.
 * Core's `RangeError` quotes no value, but the message here names the action only, as the rest do.
 */
function recipeAmountColumns({ entry, amount, useCurrentFoodData }: RecipeEntryUpdate): EntryRow {
  // Widened, because the types already say a recipe entry has no food data; this is for a caller past them.
  const requestedFoodData: unknown = useCurrentFoodData;
  if (requestedFoodData === true) {
    throw new RangeError("Only a food entry has a food to update to");
  }
  if (amount === undefined) {
    return {};
  }

  let next: RecipeLogEntry;
  try {
    next = recomputeRecipeEntry(entry, amount);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new RangeError("Could not update the entry: the amount or the recipe is not valid");
    }
    throw error;
  }
  return {
    quantity: next.quantity,
    unit: next.unit,
    resolved_grams: next.resolved_grams,
    snapshot: next.snapshot,
    nutrients: next.nutrients,
  };
}

async function currentFoodColumns(
  client: SupabaseClient<Database>,
  { entry, amount, useCurrentFoodData }: Exclude<EntryUpdate, RecipeEntryUpdate>,
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
  const { entry, amount, useCurrentFoodData, time, quick } = update;
  const changesFood = amount !== undefined || useCurrentFoodData === true;
  if (!changesFood && time === undefined && quick === undefined) {
    throw new RangeError(
      "An entry update needs an amount, a time, new values or the current food data",
    );
  }
  // Widened, because the types already say a food has no quick values; this is for a caller past them.
  const entryKind: string = entry.item_type;
  if (quick !== undefined && entryKind !== "quick") {
    throw new RangeError("Only a quick add has values of its own to change");
  }

  // The pure parts first, so a bad time or values fail before the food is read.
  const timing = time === undefined ? {} : timingColumns(time);
  const quickValues = quick === undefined ? {} : quickColumns(entry, quick);
  const food = !changesFood
    ? {}
    : isRecipeUpdate(update)
      ? recipeAmountColumns(update)
      : await currentFoodColumns(client, update);

  const columns: EntryRow = { ...food, ...quickValues, ...timing };
  const writtenPortionId = columns.portion_id ?? null;

  const { data, error } = await writeWithoutDeadPortion(writtenPortionId, (portionId) =>
    client
      .from("food_log_entries")
      .update(portionId === writtenPortionId ? columns : { ...columns, portion_id: null })
      .eq("id", entry.id)
      .is("deleted_at", null)
      .select(ENTRY_COLUMNS)
      .maybeSingle(),
  );

  if (error) {
    throw repoError("update the entry", error);
  }
  if (data === null) {
    throw new Error(`The entry ${entry.id} was not found`);
  }

  return parseRow(logEntrySchema, data, "read the updated entry", idOfRow);
}
