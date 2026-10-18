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
  /** The `workout_sessions` rows. Only whether there is one is read. */
  sessions: Row[];
  /** Fails the reads of this table with a database error. */
  failingTables: Set<string>;
  /** Never answers the reads of this table, as a slow connection does. */
  hungTables: Set<string>;
  /** The tables the training reads were made to, in order. */
  requests: string[];
} = {
  routine: null,
  sessions: [],
  failingTables: new Set(),
  hungTables: new Set(),
  requests: [],
};

export function resetTrainBackend(): void {
  resetDiaryBackend();
  trainBackend.routine = null;
  trainBackend.sessions = [];
  trainBackend.failingTables.clear();
  trainBackend.hungTables.clear();
  trainBackend.requests = [];
}

/** The number of reads made to a training table. */
export const trainRequestsTo = (table: string): number =>
  trainBackend.requests.filter((requested) => requested === table).length;

/** An active routine of one day with no exercises, which is all the Train home asks of it. */
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

/** A live session, of which only the id is read. */
export const loggedSession: Row = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function trainFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const table = new URL(address).pathname.split("/").pop() ?? "";

  if (table !== "routines" && table !== "workout_sessions") {
    return diaryFetch(input, init);
  }

  trainBackend.requests.push(table);
  if (trainBackend.hungTables.has(table)) {
    return new Promise(() => undefined);
  }
  if (trainBackend.failingTables.has(table)) {
    return jsonResponse(
      { code: "XX000", message: "raw database text", details: null, hint: null },
      500,
    );
  }

  if (table === "routines") {
    return jsonResponse(trainBackend.routine === null ? [] : [trainBackend.routine]);
  }
  return jsonResponse(trainBackend.sessions);
}

/** A real Supabase client whose network is the fake database above, for the provider the Train home reads through. */
export const trainClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: trainFetch },
});
