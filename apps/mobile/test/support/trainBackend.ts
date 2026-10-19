import { createClient } from "@supabase/supabase-js";

import { fakeFetch as diaryFetch, resetDiaryBackend } from "./diaryBackend";

import type { Database } from "@keylow/api-client";

type Row = Record<string, unknown>;

/**
 * What the database holds of the training tables and how it answers, which a test changes between renders.
 * The profile, which the training reads wait on (the Terms acceptance and the time zone), is the diary
 * backend's, so a test sets those there.
 */
export const trainBackend: {
  /** The active routine as PostgREST returns it, or null for none. */
  routine: Row | null;
  /** The `workout_sessions` rows of the read that asks whether any session was ever logged. Only whether there is one is read. */
  sessions: Row[];
  /** The live sessions of the week, each with its `workout_sets`, as the week read returns them. */
  weekSessions: Row[];
  /** The newest session that has not ended, with its routine day and its `workout_sets`, or null for none. */
  activeSession: Row | null;
  /** Fails the reads of this table with a database error. `week_sessions` and `active_session` name the other two reads of `workout_sessions`. */
  failingTables: Set<string>;
  /** Never answers the reads of this table, as a slow connection does. */
  hungTables: Set<string>;
  /** The tables the training reads were made to, in order. The week read and the active session read are `week_sessions` and `active_session`. */
  requests: string[];
  /** The unit the profile shows loads in. */
  weightUnit: "kg" | "lb";
  /**
   * The `workout_sets` rows of the sessions before, as the "previous" read returns them: with `session_id`,
   * and `workout_sessions` holding the session's `local_date`. The read keeps the rows of its exercise.
   * `last_performance` names that read in the tables above.
   */
  lastPerformance: Row[];
  /** The writes made to `workout_sets`, in order: `add_set`, `remove_set` and `restore_set`. */
  writes: string[];
  /** Fails the writes with a database error, as a refused or dropped connection does. */
  failingWrites: boolean;
  /** Holds the answer to a set insert until the test calls it, so a test can look at the screen while the write is on its way. */
  holdAddSet: Promise<void> | null;
  /** The sets removed from the active session, which Undo brings back. */
  removedSets: Row[];
} = {
  routine: null,
  sessions: [],
  weekSessions: [],
  activeSession: null,
  failingTables: new Set(),
  hungTables: new Set(),
  requests: [],
  weightUnit: "kg",
  lastPerformance: [],
  writes: [],
  failingWrites: false,
  holdAddSet: null,
  removedSets: [],
};

export function resetTrainBackend(): void {
  resetDiaryBackend();
  trainBackend.routine = null;
  trainBackend.sessions = [];
  trainBackend.weekSessions = [];
  trainBackend.activeSession = null;
  trainBackend.failingTables.clear();
  trainBackend.hungTables.clear();
  trainBackend.requests = [];
  trainBackend.weightUnit = "kg";
  trainBackend.lastPerformance = [];
  trainBackend.writes = [];
  trainBackend.failingWrites = false;
  trainBackend.holdAddSet = null;
  trainBackend.removedSets = [];
  nextSetNumber = 0;
}

/** The number of reads made to a training table. */
export const trainRequestsTo = (table: string): number =>
  trainBackend.requests.filter((requested) => requested === table).length;

/** An active routine of one day with no exercises, for the tests that are not about what the day holds. */
export const activeRoutine: Row = {
  id: "88888888-8888-4888-8888-888888888888",
  name: "Push Pull Legs",
  activated_at: null,
  routine_days: [
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      name: "Legs",
      position: 0,
      weekday: 3,
      routine_exercises: [],
    },
  ],
};

/** A live session, of which only the id is read when asking whether any session was ever logged. */
export const loggedSession: Row = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };

/** Which of the three reads of `workout_sessions` a request is, by what it filters on. */
const sessionReadOf = (url: URL): "week_sessions" | "active_session" | "workout_sessions" => {
  if (url.searchParams.has("local_date")) {
    return "week_sessions";
  }
  return url.searchParams.get("ended_at") === "is.null" ? "active_session" : "workout_sessions";
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let nextSetNumber = 0;

const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null;

const rowsOf = (value: unknown): Row[] => (Array.isArray(value) ? value.filter(isRow) : []);

/** The `workout_sets` of the open session. A write keeps its change with `saveSetsOfActiveSession`. */
export const setsOfActiveSession = (): Row[] =>
  rowsOf(trainBackend.activeSession?.["workout_sets"]);

export function saveSetsOfActiveSession(sets: Row[]): void {
  if (trainBackend.activeSession !== null) {
    trainBackend.activeSession = { ...trainBackend.activeSession, workout_sets: sets };
  }
}

const bodyOf = (init?: RequestInit): Row => {
  const parsed: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : {};
  return isRow(parsed) ? parsed : {};
};

const wantsOneObject = (init?: RequestInit): boolean =>
  new Headers(init?.headers).get("Accept")?.includes("vnd.pgrst.object") === true;

const oneRow = (rows: Row[], init?: RequestInit): Response =>
  wantsOneObject(init)
    ? jsonResponse(rows[0] ?? null, rows.length === 0 ? 406 : 200)
    : jsonResponse(rows);

/** The exercise of the routine with its muscle map, as the read the snapshot is taken from returns it. */
function exerciseRead(url: URL, init?: RequestInit): Response {
  const id = (url.searchParams.get("id") ?? "").replace("eq.", "");
  const found = rowsOf(trainBackend.routine?.["routine_days"])
    .flatMap((day) => rowsOf(day["routine_exercises"]))
    .flatMap((entry) => rowsOf([entry["exercises"]]))
    .find((exercise) => exercise["id"] === id);
  return oneRow(found === undefined ? [] : [found], init);
}

/** The writes and the reads that go with them: the count of live sets, the insert, remove and restore. */
async function setWrite(url: URL, init?: RequestInit): Promise<Response | null> {
  const method = init?.method ?? "GET";
  const sets = setsOfActiveSession();
  if (method === "GET" && url.searchParams.get("select") === "position") {
    const live = sets.filter((row) => row["deleted_at"] === null);
    const highest = live.map((row) => Number(row["position"])).sort((a, b) => b - a)[0];
    return new Response(JSON.stringify(highest === undefined ? [] : [{ position: highest }]), {
      status: 200,
      headers: { "Content-Type": "application/json", "Content-Range": `0-0/${live.length}` },
    });
  }
  if (method === "GET" && url.searchParams.has("id")) {
    const id = (url.searchParams.get("id") ?? "").replace("eq.", "");
    const row = [...sets, ...trainBackend.removedSets].find((entry) => entry["id"] === id);
    return oneRow(row === undefined ? [] : [row], init);
  }
  if (method === "POST") {
    trainBackend.writes.push("add_set");
    if (trainBackend.holdAddSet !== null) {
      await trainBackend.holdAddSet;
    }
    if (trainBackend.failingWrites) {
      return jsonResponse(
        { code: "XX000", message: "raw database text", details: null, hint: null },
        500,
      );
    }
    nextSetNumber += 1;
    const row = {
      ...bodyOf(init),
      id: `00000009-0000-4000-8000-${String(nextSetNumber).padStart(12, "0")}`,
      deleted_at: null,
    };
    sets.push(row);
    saveSetsOfActiveSession(sets);
    return oneRow([row], init);
  }
  if (method === "PATCH") {
    const id = (url.searchParams.get("id") ?? "").replace("eq.", "");
    const body = bodyOf(init);
    const isRemoval = body["deleted_at"] !== null;
    trainBackend.writes.push(isRemoval ? "remove_set" : "restore_set");
    if (trainBackend.failingWrites) {
      return jsonResponse(
        { code: "XX000", message: "raw database text", details: null, hint: null },
        500,
      );
    }
    const from = isRemoval ? sets : trainBackend.removedSets;
    const to = isRemoval ? trainBackend.removedSets : sets;
    const index = from.findIndex((row) => row["id"] === id);
    const [moved] = index === -1 ? [] : from.splice(index, 1);
    if (moved === undefined) {
      return oneRow([], init);
    }
    const updated = { ...moved, deleted_at: body["deleted_at"] };
    to.push(updated);
    saveSetsOfActiveSession(sets);
    return oneRow([updated], init);
  }
  return null;
}

export async function trainFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(address);
  const table = url.pathname.split("/").pop() ?? "";

  if (table === "profiles" && url.searchParams.get("select") === "weight_unit") {
    return jsonResponse([{ weight_unit: trainBackend.weightUnit }]);
  }
  if (table === "exercises" && url.searchParams.get("select")?.includes("exercise_muscles")) {
    return exerciseRead(url, init);
  }
  if (table !== "routines" && table !== "workout_sessions" && table !== "workout_sets") {
    return diaryFetch(input, init);
  }
  if (table === "workout_sets") {
    const written = await setWrite(url, init);
    if (written !== null) {
      return written;
    }
  }

  const read =
    table === "workout_sessions"
      ? sessionReadOf(url)
      : table === "workout_sets"
        ? "last_performance"
        : table;
  trainBackend.requests.push(read);
  if (trainBackend.hungTables.has(read)) {
    return new Promise(() => undefined);
  }
  if (trainBackend.failingTables.has(read)) {
    return jsonResponse(
      { code: "XX000", message: "raw database text", details: null, hint: null },
      500,
    );
  }

  if (table === "routines") {
    return jsonResponse(trainBackend.routine === null ? [] : [trainBackend.routine]);
  }
  if (read === "last_performance") {
    const exerciseFilter = url.searchParams.get("exercise_id");
    return jsonResponse(
      trainBackend.lastPerformance
        .filter((row) => exerciseFilter === `eq.${String(row["exercise_id"])}`)
        .filter((row) => url.searchParams.get("session_id") !== `neq.${String(row["session_id"])}`)
        .sort((first, second) =>
          String(second["performed_at"]).localeCompare(String(first["performed_at"])),
        ),
    );
  }
  if (read === "week_sessions") {
    return jsonResponse(trainBackend.weekSessions);
  }
  if (read === "active_session") {
    return jsonResponse(trainBackend.activeSession === null ? [] : [trainBackend.activeSession]);
  }
  return jsonResponse(trainBackend.sessions);
}

/** A real Supabase client whose network is the fake database above, for the provider the Train home reads through. */
export const trainClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: trainFetch },
});
