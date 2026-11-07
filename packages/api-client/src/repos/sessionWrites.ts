import { isValidTimeZone, toLocalDate } from "@keylow/core/dates";
import { MAX_SESSION_NOTE_LENGTH } from "@keylow/core/training";
import { z } from "zod";

import { parseRow } from "./diaryRows";
import { repoError } from "./repoError";
import { sessionDetailColumnsSchema } from "./trainingSchemas";
import { getActiveSession, getSession } from "./trainingSessions";

import type { SessionWithSets } from "./trainingSchemas";
import type { Database } from "../database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

// The session writes. A session and its note are health data, so a failure here names the action and
// the error code only, as the reads do, and a check that fails before a request names the rule and
// never a value. Every write needs a connection: nothing is queued.

const ROW_ID = z.guid();

/** The columns of a session that finishing it reads first. */
const SESSION_SPAN_SCHEMA = sessionDetailColumnsSchema.pick({ started_at: true, ended_at: true });

/** What PostgREST answers when a single row is asked for and there is none, which is also how a session of another user looks. */
const NO_ROW = "PGRST116";

/** How many times a start is tried again when its insert lost a race and the winner cannot be read back. */
const RETRIES_AFTER_A_LOST_RACE = 1;

/** A unique_violation, the code Postgres raises when a row breaks a unique index. */
const UNIQUE_VIOLATION = "23505";

function assertSessionId(id: string): void {
  if (!ROW_ID.safeParse(id).success) {
    throw new RangeError("A session id must be a UUID");
  }
}

function assertValidDate(date: Date, rule: string): void {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(rule);
  }
}

export type SessionStart = {
  /** The planned day the session follows, or null or left out for a free session. */
  routineDayId?: string | null | undefined;
  /** The moment the session starts. */
  now: Date;
  /** The profile's IANA zone, which the local day of the start is worked out in. */
  tz: string;
};

/**
 * Starts a session now, on the planned day `routineDayId` or free, and resolves to it as stored. The
 * local day is the calendar day of `now` in `tz`, so a start at 00:30 on a Monday in London stores
 * Monday. A zone that is not an IANA name, a routine day id that is not a UUID and a `now` that is not
 * a date throw a `RangeError` before any request.
 *
 * If the signed in user already has a session in progress, nothing is inserted and that session is the
 * result, whatever day it follows: a second tap, or a second device that got there first. This is a
 * read and then an insert. Two calls that overlap in time (two devices) can both pass the read, and
 * the unique index `workout_sessions_one_open_per_user` then refuses the second insert with 23505,
 * which is answered by reading back the session in progress, so both calls resolve to the same one.
 * If that session was finished or deleted again in the meantime and cannot be read back, the whole
 * start is tried once more, and then fails with the action and the code 23505.
 */
export async function startSession(
  client: SupabaseClient<Database>,
  { routineDayId = null, now, tz }: SessionStart,
): Promise<SessionWithSets> {
  if (!isValidTimeZone(tz)) {
    throw new RangeError("A session time zone must be an IANA name");
  }
  if (routineDayId !== null && !ROW_ID.safeParse(routineDayId).success) {
    throw new RangeError("A routine day id must be a UUID");
  }
  assertValidDate(now, "A session start must be a valid date");

  return startWithRetry(
    client,
    {
      started_at: now.toISOString(),
      local_date: toLocalDate(now, tz),
      tz,
      routine_day_id: routineDayId,
    },
    RETRIES_AFTER_A_LOST_RACE,
  );
}

type NewSession = Database["public"]["Tables"]["workout_sessions"]["Insert"];

/**
 * Finds the session in progress, or inserts one. When the unique index refuses the insert, another
 * call started one first, and that session is read back. If it cannot be read (it was finished or
 * deleted again in between), the whole start is tried again `retries` more times, then fails.
 */
async function startWithRetry(
  client: SupabaseClient<Database>,
  row: NewSession,
  retries: number,
): Promise<SessionWithSets> {
  const inProgress = await getActiveSession(client);
  if (inProgress !== null) {
    return inProgress;
  }

  const { data, error } = await client.from("workout_sessions").insert(row).select("id").single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      const winner = await getActiveSession(client);
      if (winner !== null) {
        return winner;
      }
      if (retries > 0) {
        return startWithRetry(client, row, retries - 1);
      }
    }
    throw repoError("start the session", error);
  }

  const stored = await getSession(client, data.id);
  if (stored === null) {
    throw repoError("start the session", { code: NO_ROW });
  }
  return stored;
}

export type SessionFinish = {
  /** The moment the session ends. It is not before the session started. */
  endedAt: Date;
  /** The note as typed, or null for none. It is trimmed, a blank one is stored as null, and at most 1,000 characters are allowed. */
  note: string | null;
};

/**
 * Ends a session at `endedAt` with a note, and resolves to it as stored. The end is set once: a
 * session that has already ended is returned as it is, and nothing is written. A note over 1,000
 * characters (counted as the database counts them), an end before the start and an id that is not a
 * UUID throw a `RangeError` naming the rule. The first two are checked before any write, and the note
 * before any request. A session that does not exist, is not the caller's or was deleted fails with
 * the code PGRST116, the same in all three cases.
 */
export async function finishSession(
  client: SupabaseClient<Database>,
  id: string,
  { endedAt, note }: SessionFinish,
): Promise<SessionWithSets> {
  assertSessionId(id);
  assertValidDate(endedAt, "A session end must be a valid date");
  const trimmedNote = note?.trim() ?? "";
  if (Array.from(trimmedNote).length > MAX_SESSION_NOTE_LENGTH) {
    throw new RangeError("A session note must be 1,000 characters or fewer");
  }

  const { data: span, error: readError } = await client
    .from("workout_sessions")
    .select("started_at,ended_at")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (readError) {
    throw repoError("finish the session", readError);
  }
  const { started_at, ended_at } = parseRow(
    SESSION_SPAN_SCHEMA,
    span,
    "read the session",
    () => id,
  );

  if (ended_at === null) {
    if (endedAt.getTime() < Date.parse(started_at)) {
      throw new RangeError("A session cannot end before it starts");
    }

    // Only a session still in progress is changed, so a finish from another device that got there
    // first is not overwritten.
    const { error } = await client
      .from("workout_sessions")
      .update({ ended_at: endedAt.toISOString(), note: trimmedNote === "" ? null : trimmedNote })
      .eq("id", id)
      .is("ended_at", null)
      .is("deleted_at", null);
    if (error) {
      throw repoError("finish the session", error);
    }
  }

  const stored = await getSession(client, id);
  if (stored === null) {
    throw repoError("finish the session", { code: NO_ROW });
  }
  return stored;
}

/**
 * Deletes a session and its sets with one `delete_workout_session` call, which soft deletes them
 * together, so the heat read no longer counts them. The app's own delete keeps no Undo, and
 * `restoreSession` is the way back for a caller that holds the stamp. A session that does not exist, is
 * not the caller's or is already deleted fails with the code P0002, the same in all three cases. An id
 * that is not a UUID throws a `RangeError` before any request.
 */
export async function deleteSession(client: SupabaseClient<Database>, id: string): Promise<void> {
  assertSessionId(id);

  const { error } = await client.rpc("delete_workout_session", {
    p_session_id: id,
  } satisfies Database["public"]["Functions"]["delete_workout_session"]["Args"]);

  if (error) {
    throw repoError("delete the session", error);
  }
}

export type SessionRestore = {
  /** The `deleted_at` of the deleted session exactly as the database stored it, microseconds included. */
  deletedAt: string;
};

/**
 * Brings back a session deleted by `deleteSession`, and the sets that delete took with it, and resolves
 * to it as stored. `deletedAt` is the session's stored `deleted_at`, passed back untouched (a `Date`
 * would drop its microseconds). Two writes, in this order because the database refuses to revive a set
 * behind a deleted session: the session is made live only if its `deleted_at` still equals `deletedAt`,
 * then the sets that carry the same `deletedAt` are. A set removed on its own before the delete has
 * another stamp and stays removed. A retry after a failure between the two is safe: the session is
 * already live, which is not an error, and the second write finds the sets by the stamp. A second call
 * changes nothing. A session that does not exist, is not the caller's or was deleted again with another
 * stamp fails with the code PGRST116. An id that is not a UUID and a stamp that is not a timestamp throw
 * a `RangeError` naming the rule, before any request. Restoring a session that was still in progress when
 * it was deleted, while the user has started another, fails with the code 23505, from the index that
 * allows one open session per user.
 */
export async function restoreSession(
  client: SupabaseClient<Database>,
  id: string,
  { deletedAt }: SessionRestore,
): Promise<SessionWithSets> {
  assertSessionId(id);
  assertValidDate(new Date(deletedAt), "A session delete stamp must be a timestamp");

  const { data: made, error: sessionError } = await client
    .from("workout_sessions")
    .update({ deleted_at: null })
    .eq("id", id)
    .eq("deleted_at", deletedAt)
    .select("id");
  if (sessionError) {
    throw repoError("restore the session", sessionError);
  }
  if (made.length === 0) {
    await assertLive(client, id);
  }

  const { error: setsError } = await client
    .from("workout_sets")
    .update({ deleted_at: null })
    .eq("session_id", id)
    .eq("deleted_at", deletedAt);
  if (setsError) {
    throw repoError("restore the session", setsError);
  }

  const stored = await getSession(client, id);
  if (stored === null) {
    throw repoError("restore the session", { code: NO_ROW });
  }
  return stored;
}

/** Passes for a session that is live, which is how a retry finds it. Anything else fails as a missing row. */
async function assertLive(client: SupabaseClient<Database>, id: string): Promise<void> {
  const { data, error } = await client
    .from("workout_sessions")
    .select("deleted_at")
    .eq("id", id)
    .single();
  if (error) {
    throw repoError("restore the session", error);
  }
  if (data.deleted_at !== null) {
    throw repoError("restore the session", { code: NO_ROW });
  }
}
