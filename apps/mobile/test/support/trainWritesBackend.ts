import { createClient } from "@supabase/supabase-js";

import { trainBackend, trainFetch } from "./trainBackend";

import type { Database } from "@keylow/api-client";

type Row = Record<string, unknown>;

/**
 * What the session writes did and how they answer, which a test changes between renders. The reads are
 * `trainBackend`'s, and a start puts the session it made in the open session `trainBackend` answers with,
 * a discard takes it away, as the database would.
 */
export const trainWrites: {
  /** The rows the starts inserted, as sent. */
  inserted: Row[];
  /** The session ids the discards were asked for. */
  deletedIds: string[];
  /** Holds every insert until this settles, so a test can press again while the first start is pending. */
  holdInserts: Promise<void> | null;
  /** Holds every discard until this settles, so a test can press again while the discard is under way. */
  holdDeletes: Promise<void> | null;
  /** Fails the inserts with a database error. */
  failInserts: boolean;
  /** Fails the discards with a database error. */
  failDeletes: boolean;
  /** Loses the network on the discards, as a phone does mid-request. */
  loseNetworkOnDeletes: boolean;
} = {
  inserted: [],
  deletedIds: [],
  holdInserts: null,
  holdDeletes: null,
  failInserts: false,
  failDeletes: false,
  loseNetworkOnDeletes: false,
};

export function resetTrainWrites(): void {
  trainWrites.inserted = [];
  trainWrites.deletedIds = [];
  trainWrites.holdInserts = null;
  trainWrites.holdDeletes = null;
  trainWrites.failInserts = false;
  trainWrites.failDeletes = false;
  trainWrites.loseNetworkOnDeletes = false;
}

export const STARTED_SESSION_ID = "00000009-0000-4000-8000-000000000001";

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const databaseError = (code: string): Response =>
  jsonResponse({ code, message: "raw database text", details: null, hint: null }, 500);

/** The session as the database stores a start: nothing logged, and the day's name when it follows a day. */
const startedSessionRow = (inserted: Row): Row => ({
  id: STARTED_SESSION_ID,
  started_at: inserted["started_at"],
  ended_at: null,
  local_date: inserted["local_date"],
  routine_day_id: inserted["routine_day_id"],
  note: null,
  deleted_at: null,
  routine_days: inserted["routine_day_id"] === null ? null : { name: "Legs" },
  workout_sets: [],
});

/** The request's JSON body, or nothing when it has none. */
function jsonBodyOf(init: RequestInit | undefined): unknown {
  return typeof init?.body === "string" ? JSON.parse(init.body) : null;
}

async function writesFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(address).pathname;
  const method = init?.method ?? "GET";

  if (method === "POST" && path.endsWith("/workout_sessions")) {
    await trainWrites.holdInserts;
    if (trainWrites.failInserts) {
      return databaseError("XX000");
    }
    const body = jsonBodyOf(init);
    const inserted = typeof body === "object" && body !== null ? { ...body } : {};
    trainWrites.inserted.push(inserted);
    trainBackend.activeSession = startedSessionRow(inserted);
    return jsonResponse({ id: STARTED_SESSION_ID }, 201);
  }
  if (method === "POST" && path.endsWith("/rpc/delete_workout_session")) {
    await trainWrites.holdDeletes;
    if (trainWrites.loseNetworkOnDeletes) {
      throw new TypeError("Network request failed");
    }
    if (trainWrites.failDeletes) {
      return databaseError("XX000");
    }
    const body = jsonBodyOf(init);
    const sessionId =
      typeof body === "object" && body !== null && "p_session_id" in body
        ? String(body.p_session_id)
        : "";
    trainWrites.deletedIds.push(sessionId);
    if (trainBackend.activeSession?.["id"] === sessionId) {
      trainBackend.activeSession = null;
    }
    trainBackend.weekSessions = trainBackend.weekSessions.filter(
      (session) => session["id"] !== sessionId,
    );
    return new Response(null, { status: 204 });
  }
  // The read of the session just started, by its id.
  if (
    method === "GET" &&
    path.endsWith("/workout_sessions") &&
    new URL(address).searchParams.get("id") === `eq.${STARTED_SESSION_ID}`
  ) {
    return jsonResponse(
      trainBackend.activeSession === null ? [] : [trainBackend.activeSession],
      200,
    );
  }
  return trainFetch(input, init);
}

/** A real Supabase client whose network is the fake database, with the session writes. */
export const trainWritesClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: writesFetch },
});
