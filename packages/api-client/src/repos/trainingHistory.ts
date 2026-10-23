import { idOfRow, parseRow } from "./diaryRows";
import { readSnapshot, trainingRepoError, trainingWeekBounds } from "./training";
import {
  HISTORY_SET_COLUMNS,
  SESSION_COLUMNS,
  historySessionColumnsSchema,
  historySetColumnsSchema,
} from "./trainingSchemas";
import { weekStartOf } from "../weekStartOf";

import type { HistorySessionRow, HistorySetRow } from "./trainingSchemas";
import type { Database } from "../database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

// A session holds sets, and a set holds an exercise name, an effort and a muscle share: all health
// data. A failure here names the action and the error code only, and the cause holds the code and
// nothing else, because the database's own message and details can quote the row that failed.

/** The most rows PostgREST returns for one request (`max_rows` in `packages/db/supabase/config.toml`). */
const PAGE_SIZE = 1000;

// `!inner` keeps a session only when it has a set that passes the filters on `workout_sets`, so a
// session with no live set is never read.
const HISTORY_SELECT = `${SESSION_COLUMNS},routine_days(name),workout_sets!inner(${HISTORY_SET_COLUMNS})`;

function parseHistorySet(row: unknown): HistorySetRow {
  const columns = parseRow(historySetColumnsSchema, row, "read your history", idOfRow);
  return { ...columns, snapshot: readSnapshot(columns, "read your history") };
}

function parseHistorySession(row: unknown): HistorySessionRow {
  const { routine_days, workout_sets, ...session } = parseRow(
    historySessionColumnsSchema,
    row,
    "read your history",
    idOfRow,
  );
  return {
    ...session,
    routine_day_name: routine_days?.name ?? null,
    sets: workout_sets.map(parseHistorySet),
  };
}

/**
 * The signed in user's sessions of the week that starts on the Monday `weekStart`, `YYYY-MM-DD`, that
 * have at least one live set (a warm-up counts), by the local date of their start, newest first
 * (`started_at`, then `id`, both descending). Whether the session was ended, and how far it strayed
 * from its plan, do not matter: a session that happened shows. Each has its routine day's name (null for
 * a free session) and its live sets in list order, with the columns the history list shows: the reps
 * and the load are not read. Soft-deleted sessions and sets are left out, and so is a session whose
 * sets were all deleted or that has none yet; a week with nothing logged resolves to an empty list.
 * The API returns at most 1,000 rows to a request, so the sessions are read a page at a time until a
 * page comes back short. Row level security shows a user their own sessions only. Throws a `RangeError`
 * before any request when `weekStart` is not a Monday.
 */
export async function listSessionsInWeek(
  client: SupabaseClient<Database>,
  weekStart: string,
): Promise<HistorySessionRow[]> {
  const { first, last } = trainingWeekBounds(weekStart);
  const sessions: HistorySessionRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from("workout_sessions")
      .select(HISTORY_SELECT)
      .is("deleted_at", null)
      .gte("local_date", first)
      .lte("local_date", last)
      .is("workout_sets.deleted_at", null)
      .order("started_at", { ascending: false })
      .order("id", { ascending: false })
      .order("position", { ascending: true, referencedTable: "workout_sets" })
      .order("performed_at", { ascending: true, referencedTable: "workout_sets" })
      .order("id", { ascending: true, referencedTable: "workout_sets" })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw trainingRepoError("load your history", error);
    }

    sessions.push(...data.map(parseHistorySession));

    if (data.length < PAGE_SIZE) {
      return sessions;
    }
  }
}

/**
 * The Monday of the newest week before the one that starts on the Monday `beforeWeekStart` that has a
 * live session with at least one live set, or null when there is none. It is what "load earlier weeks"
 * walks, so the list never pages through a week with nothing logged, nor one that holds only empty
 * sessions. Without `beforeWeekStart` it gives the newest week with such a session at all. One request
 * reads a single local date and no session content.
 * Throws a `RangeError` before any request when `beforeWeekStart` is not a Monday.
 */
export async function findPreviousSessionWeek(
  client: SupabaseClient<Database>,
  beforeWeekStart?: string,
): Promise<string | null> {
  if (beforeWeekStart !== undefined) {
    trainingWeekBounds(beforeWeekStart);
  }

  const live = client
    .from("workout_sessions")
    .select("local_date,workout_sets!inner(id)")
    .is("deleted_at", null)
    .is("workout_sets.deleted_at", null);
  const { data, error } = await (
    beforeWeekStart === undefined ? live : live.lt("local_date", beforeWeekStart)
  )
    .order("local_date", { ascending: false })
    .limit(1);

  if (error) {
    throw trainingRepoError("load your history", error);
  }

  const newest = data[0]?.local_date;
  return newest === undefined ? null : weekStartOf(newest);
}
