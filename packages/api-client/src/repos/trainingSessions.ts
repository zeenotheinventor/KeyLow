import { z } from "zod";

import { idOfRow, parseRow } from "./diaryRows";
import { readSnapshot, trainingRepoError } from "./training";
import {
  LAST_PERFORMANCE_COLUMNS,
  SESSION_DETAIL_COLUMNS,
  SESSION_SET_COLUMNS,
  lastPerformanceRowSchema,
  sessionSetColumnsSchema,
  sessionWithSetsColumnsSchema,
} from "./trainingSchemas";

import type {
  LastPerformanceSession,
  LastPerformanceSet,
  SessionSet,
  SessionWithSets,
} from "./trainingSchemas";
import type { Database } from "../database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

// A session holds sets, and a set holds an exercise name, a load and an effort: all health data. A
// failure here names the action and the error code only, and the cause holds the code and nothing
// else, because the database's own message and details can quote the row that failed.

const ROW_ID = z.guid();

/** The most rows read for one session. 30 leaves room for any real exercise, and a session past it is cut at its oldest sets. */
const ROWS_PER_SESSION = 30;

const DEFAULT_SESSIONS = 2;

/**
 * A session with its routine day's name and its live sets, both ordered by the database: a set by its
 * `position`, then when it was `performed_at`, then its `id`.
 */
const SESSION_SELECT = `${SESSION_DETAIL_COLUMNS},routine_days(name),workout_sets(${SESSION_SET_COLUMNS})`;

/** A set of a session read: its columns checked, and its snapshot by core. */
export function parseSessionSet(row: unknown, action: string): SessionSet {
  const columns = parseRow(sessionSetColumnsSchema, row, action, idOfRow);
  return { ...columns, snapshot: readSnapshot(columns, action) };
}

function parseSessionRow(row: unknown, action: string): SessionWithSets {
  const { routine_days, workout_sets, ...session } = parseRow(
    sessionWithSetsColumnsSchema,
    row,
    action,
    idOfRow,
  );
  return {
    ...session,
    routine_day_name: routine_days?.name ?? null,
    sets: workout_sets.map((set) => parseSessionSet(set, action)),
  };
}

/**
 * One live session of the signed in user with its routine day's name (null for a free session) and its
 * live sets in the order they are listed: by `position`, then `performed_at`, then `id`. A session that
 * does not exist, is not the caller's or is soft deleted reads as null, the same in all three cases, and
 * so does a session id of another user (row level security shows a user their own sessions only).
 * Throws a `RangeError` before any request when `id` is not a UUID.
 */
export async function getSession(
  client: SupabaseClient<Database>,
  id: string,
): Promise<SessionWithSets | null> {
  if (!ROW_ID.safeParse(id).success) {
    throw new RangeError("A session id must be a UUID");
  }

  const { data, error } = await client
    .from("workout_sessions")
    .select(SESSION_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .is("workout_sets.deleted_at", null)
    .order("position", { ascending: true, referencedTable: "workout_sets" })
    .order("performed_at", { ascending: true, referencedTable: "workout_sets" })
    .order("id", { ascending: true, referencedTable: "workout_sets" })
    .maybeSingle();

  if (error) {
    throw trainingRepoError("load your session", error);
  }

  return data === null ? null : parseSessionRow(data, "read the session");
}

/**
 * The signed in user's newest live session that has not ended, with its sets as `getSession` gives them,
 * or null when there is none. The session bar and the Resume button read it.
 */
export async function getActiveSession(
  client: SupabaseClient<Database>,
): Promise<SessionWithSets | null> {
  const { data, error } = await client
    .from("workout_sessions")
    .select(SESSION_SELECT)
    .is("deleted_at", null)
    .is("ended_at", null)
    .is("workout_sets.deleted_at", null)
    .order("started_at", { ascending: false })
    .order("id", { ascending: false })
    .order("position", { ascending: true, referencedTable: "workout_sets" })
    .order("performed_at", { ascending: true, referencedTable: "workout_sets" })
    .order("id", { ascending: true, referencedTable: "workout_sets" })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw trainingRepoError("load your session", error);
  }

  return data === null ? null : parseSessionRow(data, "read the session");
}

export type LastPerformanceOptions = {
  /** The session being logged, which is left out. Nothing is left out when it is not given. */
  excludeSessionId?: string | undefined;
  /** How many earlier sessions to give at most. Defaults to 2. */
  sessions?: number;
};

const compareText = (first: string, second: string): number => {
  if (first === second) {
    return 0;
  }
  return first < second ? -1 : 1;
};

// The display order of a session's sets: position, then the moment performed, then id. It is the order
// of core's `orderSessionSets` and of the session reads above.
const byListOrder = (first: LastPerformanceSet, second: LastPerformanceSet): number =>
  first.position - second.position ||
  Date.parse(first.performed_at) - Date.parse(second.performed_at) ||
  compareText(first.id, second.id);

/**
 * The working sets (every type but a warm-up) of one exercise from its latest earlier sessions, for the
 * "previous" values of a set and the prefill: at most `sessions` (2 unless given) sessions, newest
 * first, each with its local date and its sets in list order. Soft-deleted sets and the sets of
 * soft-deleted sessions are left out, and so is `excludeSessionId`. One request, which reads the
 * exercise's newest sets by `performed_at` (the index on `user_id, performed_at` can serve it, since row
 * level security adds the user) and stops at 30 rows a session, 60 for two, so a session whose sets of
 * this exercise run past that is cut at its oldest. Throws a `RangeError` before any request for an id
 * that is not a UUID or a count that is not a positive whole number.
 */
export async function getLastPerformance(
  client: SupabaseClient<Database>,
  exerciseId: string,
  { excludeSessionId, sessions = DEFAULT_SESSIONS }: LastPerformanceOptions = {},
): Promise<LastPerformanceSession[]> {
  if (!ROW_ID.safeParse(exerciseId).success) {
    throw new RangeError("An exercise id must be a UUID");
  }
  if (excludeSessionId !== undefined && !ROW_ID.safeParse(excludeSessionId).success) {
    throw new RangeError("A session id must be a UUID");
  }
  if (!Number.isInteger(sessions) || sessions < 1) {
    throw new RangeError("The number of sessions must be a positive whole number");
  }

  const query = client
    .from("workout_sets")
    .select(`${LAST_PERFORMANCE_COLUMNS},workout_sessions!inner(local_date)`)
    .eq("exercise_id", exerciseId)
    .neq("set_type", "warmup")
    .is("deleted_at", null)
    .is("workout_sessions.deleted_at", null);

  const { data, error } = await (
    excludeSessionId === undefined ? query : query.neq("session_id", excludeSessionId)
  )
    .order("performed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(sessions * ROWS_PER_SESSION);

  if (error) {
    throw trainingRepoError("load your last sets", error);
  }

  // The rows come newest first, so a session is first met at its newest set and the groups keep that order.
  const groups = new Map<string, LastPerformanceSession>();
  for (const row of data) {
    const { session_id, workout_sessions, ...set } = parseRow(
      lastPerformanceRowSchema,
      row,
      "read the last sets",
      idOfRow,
    );
    const group = groups.get(session_id) ?? {
      session_id,
      local_date: workout_sessions.local_date,
      sets: [],
    };
    group.sets.push(set);
    groups.set(session_id, group);
  }

  return [...groups.values()]
    .slice(0, sessions)
    .map((group) => ({ ...group, sets: [...group.sets].sort(byListOrder) }));
}
