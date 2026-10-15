import { foodSnapshotSchema, isEntryId, weekOf } from "@keylow/core/diary";
import { z } from "zod";

import { ENTRY_COLUMNS, dateOfRow, idOfRow, parseRow, repoError } from "./diaryRows";
import { dayLogSchema, dayTotalsSchema, logEntrySchema } from "./diarySchemas";

import type { DayLog, DayTotals, LogEntry } from "./diarySchemas";
import type { Database } from "../database.types";
import type { FoodSnapshot } from "@keylow/core/diary";
import type { SupabaseClient } from "@supabase/supabase-js";

const DAY_LOG_COLUMNS = Object.keys(dayLogSchema.shape).join(",");
const DAY_TOTALS_COLUMNS = Object.keys(dayTotalsSchema.shape).join(",");

// The recent foods come from the newest entries, so a user with a very long diary of one food still
// gets a bounded request. A food logged only before the newest 200 entries is not "recent".
const RECENT_FOODS_SCAN_LIMIT = 200;
const DEFAULT_RECENT_FOODS_LIMIT = 20;

const LOCAL_DATE = z.iso.date();
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function assertLocalDate(localDate: string): void {
  if (!LOCAL_DATE.safeParse(localDate).success) {
    throw new RangeError("A diary day must be a calendar date written YYYY-MM-DD");
  }
}

/** A day of the diary: its live entries in timeline order, and what the day says about itself. */
export type DiaryDay = {
  localDate: string;
  /** Live entries by `logged_at`, then `created_at`, then `id`. Group them by hour with `groupEntriesByHour` from core. */
  entries: LogEntry[];
  /** Null when the user never completed or annotated the day. */
  dayLog: DayLog | null;
  /** Null when the day has no live entry. */
  totals: DayTotals | null;
};

/**
 * Loads one day of the diary: its live (not deleted) entries ordered as the timeline lists them,
 * its `day_logs` row and its `day_totals` row. The three are read side by side, so they can differ
 * by an edit made between the reads, and the next refetch settles it.
 */
export async function getDiaryDay(
  client: SupabaseClient<Database>,
  localDate: string,
): Promise<DiaryDay> {
  assertLocalDate(localDate);

  const [entries, dayLog, totals] = await Promise.all([
    client
      .from("food_log_entries")
      .select(ENTRY_COLUMNS)
      .eq("local_date", localDate)
      .is("deleted_at", null)
      .order("logged_at", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    client.from("day_logs").select(DAY_LOG_COLUMNS).eq("local_date", localDate).maybeSingle(),
    client.from("day_totals").select(DAY_TOTALS_COLUMNS).eq("local_date", localDate).maybeSingle(),
  ]);

  if (entries.error) {
    throw repoError("load the day's entries", entries.error);
  }
  if (dayLog.error) {
    throw repoError("load the day's log", dayLog.error);
  }
  if (totals.error) {
    throw repoError("load the day's totals", totals.error);
  }

  return {
    localDate,
    entries: entries.data.map((row) =>
      parseRow(logEntrySchema, row, "read the day's entries", idOfRow),
    ),
    dayLog:
      dayLog.data === null
        ? null
        : parseRow(dayLogSchema, dayLog.data, "read the day's log", dateOfRow),
    totals:
      totals.data === null
        ? null
        : parseRow(dayTotalsSchema, totals.data, "read the day's totals", dateOfRow),
  };
}

/**
 * Loads one live (not deleted) entry by its id, for the screen that edits it. Resolves to null when the
 * entry does not exist, is deleted or is not the caller's.
 */
export async function getLogEntry(
  client: SupabaseClient<Database>,
  id: string,
): Promise<LogEntry | null> {
  if (!isEntryId(id)) {
    throw new RangeError("An entry id must be a UUID");
  }

  const { data, error } = await client
    .from("food_log_entries")
    .select(ENTRY_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw repoError("load the entry", error);
  }

  return data === null ? null : parseRow(logEntrySchema, data, "read the entry", idOfRow);
}

/** One day on the week strip: what `day_logs` and `day_totals` hold for it, each null when it has no row. */
export type DiaryWeekDay = {
  localDate: string;
  dayLog: DayLog | null;
  totals: DayTotals | null;
};

/**
 * Loads the week that starts on `weekStart`, which must be a Monday: always seven days, Monday to
 * Sunday, each with its `day_logs` and `day_totals` rows or null. A day with no `day_logs` row is
 * not complete. The `dayLog` rows are shaped for `weekStripDays` in core.
 */
export async function getDiaryWeek(
  client: SupabaseClient<Database>,
  weekStart: string,
): Promise<DiaryWeekDay[]> {
  assertLocalDate(weekStart);
  const days = weekOf(weekStart);
  const [first, last] = [days[0], days[6]];
  if (first !== weekStart || last === undefined) {
    throw new RangeError("A diary week must start on a Monday");
  }

  const [dayLogs, dayTotals] = await Promise.all([
    client
      .from("day_logs")
      .select(DAY_LOG_COLUMNS)
      .gte("local_date", first)
      .lte("local_date", last),
    client
      .from("day_totals")
      .select(DAY_TOTALS_COLUMNS)
      .gte("local_date", first)
      .lte("local_date", last),
  ]);

  if (dayLogs.error) {
    throw repoError("load the week's day logs", dayLogs.error);
  }
  if (dayTotals.error) {
    throw repoError("load the week's totals", dayTotals.error);
  }

  const dayLogByDate = new Map(
    dayLogs.data
      .map((row) => parseRow(dayLogSchema, row, "read the week's day logs", dateOfRow))
      .map((row) => [row.local_date, row]),
  );
  const totalsByDate = new Map(
    dayTotals.data
      .map((row) => parseRow(dayTotalsSchema, row, "read the week's totals", dateOfRow))
      .map((row) => [row.local_date, row]),
  );

  return days.map((localDate) => ({
    localDate,
    dayLog: dayLogByDate.get(localDate) ?? null,
    totals: totalsByDate.get(localDate) ?? null,
  }));
}

const firstOfNextMonth = (month: string): string => {
  const [year, monthNumber] = month.split("-").map(Number);
  if (year === undefined || monthNumber === undefined) {
    throw new RangeError("A diary month must be written YYYY-MM");
  }
  return monthNumber === 12
    ? `${year + 1}-01-01`
    : `${String(year)}-${String(monthNumber + 1).padStart(2, "0")}-01`;
};

/**
 * The dates in a calendar month (`YYYY-MM`) that the user marked complete, in date order, for the
 * dots on the date pickers. It reads `day_logs` only.
 */
export async function listCompleteDays(
  client: SupabaseClient<Database>,
  month: string,
): Promise<string[]> {
  if (!MONTH.test(month)) {
    throw new RangeError("A diary month must be written YYYY-MM");
  }

  const { data, error } = await client
    .from("day_logs")
    .select("local_date")
    .eq("is_complete", true)
    .gte("local_date", `${month}-01`)
    .lt("local_date", firstOfNextMonth(month))
    .order("local_date", { ascending: true });

  if (error) {
    throw repoError("load the complete days", error);
  }

  return data.map(
    (row) =>
      parseRow(dayLogSchema.pick({ local_date: true }), row, "read the complete days", dateOfRow)
        .local_date,
  );
}

/** A food the user logged lately, with the snapshot of the newest entry that logged it. */
export type RecentFood = {
  foodId: string;
  /** The entry the snapshot comes from. */
  entryId: string;
  loggedAt: string;
  /** The portion that entry used, null once the portion was replaced or when the unit was not `portion`. */
  portionId: string | null;
  /** Holds the amount last logged (`quantity`, `unit`, `portion`), so "log again" can pre-fill it. */
  snapshot: FoodSnapshot;
};

const recentEntrySchema = z.object({
  id: z.guid(),
  food_id: z.guid(),
  logged_at: z.iso.datetime({ offset: true }),
  portion_id: z.guid().nullable(),
  snapshot: foodSnapshotSchema,
});

/**
 * The foods the user logged most recently, each once, newest first, with the snapshot of the entry
 * that logged it last ("last" by `logged_at`, the time eaten). Quick adds, deleted entries and
 * foods that have been deleted are left out. `limit` (default 20) is a positive whole number.
 *
 * Only the newest 200 live food entries are looked at, whatever `limit` is, so a food that was last
 * logged before the newest 200 entries is not "recent" and the list can hold fewer foods than
 * `limit`. Deleting the newest entry of a food makes the list fall back to that food's earlier
 * entry, and to nothing when it has none inside the window.
 */
export async function listRecentFoods(
  client: SupabaseClient<Database>,
  { limit = DEFAULT_RECENT_FOODS_LIMIT }: { limit?: number } = {},
): Promise<RecentFood[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("The recent foods limit must be a positive whole number");
  }

  const { data, error } = await client
    .from("food_log_entries")
    .select("id, food_id, logged_at, portion_id, snapshot, foods!inner(deleted_at)")
    .eq("item_type", "food")
    .is("deleted_at", null)
    .is("foods.deleted_at", null)
    .order("logged_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(RECENT_FOODS_SCAN_LIMIT);

  if (error) {
    throw repoError("load the recent foods", error);
  }

  const newestPerFood = new Map<string, RecentFood>();
  for (const row of data) {
    const entry = parseRow(recentEntrySchema, row, "read the recent foods", idOfRow);
    if (!newestPerFood.has(entry.food_id)) {
      newestPerFood.set(entry.food_id, {
        foodId: entry.food_id,
        entryId: entry.id,
        loggedAt: entry.logged_at,
        portionId: entry.portion_id,
        snapshot: entry.snapshot,
      });
    }
  }

  return [...newestPerFood.values()].slice(0, limit);
}
