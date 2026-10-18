import { weekOf } from "@keylow/core/diary";
import { parseSetSnapshot } from "@keylow/core/training";
import { z } from "zod";

import { idOfRow, parseRow } from "./diaryRows";
import {
  SESSION_COLUMNS,
  SET_COLUMNS,
  routineColumnsSchema,
  sessionColumnsSchema,
  setColumnsSchema,
} from "./trainingSchemas";

import type { ActiveRoutine, TrainingSet, WeekSession } from "./trainingSchemas";
import type { Database } from "../database.types";
import type { SetSnapshot } from "@keylow/core/schemas";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

// A set holds an exercise name, a muscle share and an effort, and a routine holds exercise names: all
// health data. A failure here names the action and the error code only, and the cause holds the code
// and nothing else, because the database's own message and details can quote the row that failed.

/** The most rows PostgREST returns for one request (`max_rows` in `packages/db/supabase/config.toml`). */
const PAGE_SIZE = 1000;

const LOCAL_DATE = z.iso.date();

// A session row is read with its sets embedded, and a row without the list is not a session of no sets.
const sessionWithSetsSchema = sessionColumnsSchema.extend({ workout_sets: z.array(z.unknown()) });

export const trainingRepoError = (action: string, cause: PostgrestError) =>
  new Error(`Could not ${action} (${cause.code})`, { cause: { code: cause.code } });

function assertLocalDate(localDate: string): void {
  if (!LOCAL_DATE.safeParse(localDate).success) {
    throw new RangeError("A training day must be a calendar date written YYYY-MM-DD");
  }
}

/**
 * The Monday and the Sunday of the training week that starts on `weekStart`. Throws a `RangeError`
 * naming the rule when it is not a calendar date or not a Monday, before any request is made.
 */
export function trainingWeekBounds(weekStart: string): { first: string; last: string } {
  assertLocalDate(weekStart);
  const days = weekOf(weekStart);
  const [first, last] = [days[0], days[6]];
  if (first !== weekStart || last === undefined) {
    throw new RangeError("A training week must start on a Monday");
  }
  return { first, last };
}

/** A set's snapshot read by core, which names why it cannot read one. The message names the row and the problem only. */
export function readSnapshot(
  columns: { id: string; snapshot: unknown },
  action: string,
): SetSnapshot {
  const snapshot = parseSetSnapshot(columns.snapshot);
  if (!snapshot.ok) {
    throw new Error(
      `Could not ${action}: row ${columns.id} has a snapshot this app cannot read (${snapshot.problem})`,
      { cause: { code: snapshot.problem } },
    );
  }
  return snapshot.snapshot;
}

/** A set row read: its columns checked, and its snapshot by core. */
function parseSetRow(row: unknown, action: string): TrainingSet {
  const columns = parseRow(setColumnsSchema, row, action, idOfRow);
  return { ...columns, snapshot: readSnapshot(columns, action) };
}

/**
 * The live sets of the signed in user from the day `fromDay` through the day `throughDay`, both
 * `YYYY-MM-DD` and both included, oldest first. A set counts by the local date of its session, so a
 * session that runs past midnight is in one day whole. Soft-deleted sets are left out, and so are the
 * sets of a soft-deleted session. The API returns at most 1,000 rows to a request, so the sets are read
 * a page at a time until a page comes back short. Row level security shows a user their own sets only.
 */
export async function listSetsFrom(
  client: SupabaseClient<Database>,
  fromDay: string,
  throughDay: string,
): Promise<TrainingSet[]> {
  assertLocalDate(fromDay);
  assertLocalDate(throughDay);

  const sets: TrainingSet[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    // The session is joined to filter on it and none of its columns are read.
    const { data, error } = await client
      .from("workout_sets")
      .select(`${SET_COLUMNS},workout_sessions!inner()`)
      .is("deleted_at", null)
      .is("workout_sessions.deleted_at", null)
      .gte("workout_sessions.local_date", fromDay)
      .lte("workout_sessions.local_date", throughDay)
      .order("performed_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw trainingRepoError("load your sets", error);
    }

    sets.push(...data.map((row) => parseSetRow(row, "read the sets")));

    if (data.length < PAGE_SIZE) {
      return sets;
    }
  }
}

/**
 * The live sessions of the week that starts on the Monday `weekStart`, `YYYY-MM-DD`, by the local date of
 * their start, each with its live sets in the order they were performed. Soft-deleted sessions and sets
 * are left out. A week with nothing logged resolves to an empty list.
 */
export async function listWeekSessions(
  client: SupabaseClient<Database>,
  weekStart: string,
): Promise<WeekSession[]> {
  const { first, last } = trainingWeekBounds(weekStart);

  const { data, error } = await client
    .from("workout_sessions")
    .select(`${SESSION_COLUMNS},workout_sets(${SET_COLUMNS})`)
    .is("deleted_at", null)
    .gte("local_date", first)
    .lte("local_date", last)
    .is("workout_sets.deleted_at", null)
    .order("local_date", { ascending: true })
    .order("started_at", { ascending: true })
    .order("id", { ascending: true })
    .order("performed_at", { ascending: true, referencedTable: "workout_sets" })
    .order("id", { ascending: true, referencedTable: "workout_sets" });

  if (error) {
    throw trainingRepoError("load your week", error);
  }

  return data.map((row) => {
    const { workout_sets, ...session } = parseRow(
      sessionWithSetsSchema,
      row,
      "read the week",
      idOfRow,
    );
    return { ...session, sets: workout_sets.map((set) => parseSetRow(set, "read the week")) };
  });
}

/**
 * The signed in user's active routine with its days and each day's exercises in position order, and the
 * current muscle map of every exercise, or null when no routine is active. At most one routine is active
 * (a partial unique index), and row level security shows a user their own routines only.
 */
export async function getActiveRoutine(
  client: SupabaseClient<Database>,
): Promise<ActiveRoutine | null> {
  const { data, error } = await client
    .from("routines")
    .select(
      "id,name,activated_at,routine_days(id,name,position,weekday,routine_exercises(id,position,exercise_id,target_sets,target_rir,exercises(id,name,equipment,mechanic,exercise_muscles(muscle_id,role,weight))))",
    )
    .eq("is_active", true)
    .order("position", { ascending: true, referencedTable: "routine_days" })
    .order("position", { ascending: true, referencedTable: "routine_days.routine_exercises" })
    .maybeSingle();

  if (error) {
    throw trainingRepoError("load your routine", error);
  }

  return data === null ? null : parseRow(routineColumnsSchema, data, "read the routine", idOfRow);
}

/**
 * Whether the signed in user has a live session at all, however old. It tells the Train home's first
 * visit (nothing logged, ever) from a user who has trained but has no routine. One id is read and no
 * session content, so nothing health related is fetched for the answer.
 */
export async function hasLoggedSession(client: SupabaseClient<Database>): Promise<boolean> {
  const { data, error } = await client
    .from("workout_sessions")
    .select("id")
    .is("deleted_at", null)
    .limit(1);

  if (error) {
    throw trainingRepoError("check your sessions", error);
  }

  return data.length > 0;
}
