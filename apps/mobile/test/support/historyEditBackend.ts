import { createClient } from "@supabase/supabase-js";

import { historyBackend, historyFetch } from "./historyBackend";
import { sessionDetailBackend, sessionDetailFetch } from "./sessionDetailBackend";
import { trainBackend } from "./trainBackend";

import type { Database } from "@keylow/api-client";

type Row = Record<string, unknown>;

/**
 * The writes the history can make, on the sessions `sessionDetailBackend` holds: the update of a set, its
 * removal and restoring, and the delete of a session. The reads are the session detail's and the history
 * list's, over the same sessions, so a write shows in both as the database would show it. A test reads
 * back what was asked of the database and what it holds now.
 */
export const historyEditBackend: {
  /** The bodies of the set updates (not removals or restores), in order. */
  updates: Row[];
  /** The ids of the sets removed, in order. */
  removedIds: string[];
  /** The ids of the sets restored, in order. */
  restoredIds: string[];
  /** The ids of the sessions deleted, in order. */
  deletedSessionIds: string[];
  /** Holds every set write until this settles, so a test can act while a write is on its way. */
  holdWrites: Promise<void> | null;
  /** Fails every write with a database error. */
  failingWrites: boolean;
  /** The sets removed and not yet restored, which the reads no longer return. */
  removedSets: Row[];
} = {
  updates: [],
  removedIds: [],
  restoredIds: [],
  deletedSessionIds: [],
  holdWrites: null,
  failingWrites: false,
  removedSets: [],
};

export function resetHistoryEditBackend(): void {
  historyEditBackend.updates = [];
  historyEditBackend.removedIds = [];
  historyEditBackend.restoredIds = [];
  historyEditBackend.deletedSessionIds = [];
  historyEditBackend.holdWrites = null;
  historyEditBackend.failingWrites = false;
  historyEditBackend.removedSets = [];
}

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const databaseError = () =>
  jsonResponse({ code: "XX000", message: "raw database text", details: null, hint: null }, 500);

const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null;
const rowsOf = (value: unknown): Row[] => (Array.isArray(value) ? value.filter(isRow) : []);

const wantsOneObject = (init?: RequestInit): boolean =>
  new Headers(init?.headers).get("Accept")?.includes("vnd.pgrst.object") === true;

const bodyOf = (init?: RequestInit): Row => {
  const parsed: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : {};
  return isRow(parsed) ? parsed : {};
};

/** The session that holds the live set, and the set. */
function findLiveSet(setId: string) {
  for (const session of sessionDetailBackend.sessions) {
    const sets = rowsOf(session["workout_sets"]);
    const found = sets.find((row) => row["id"] === setId);
    if (found !== undefined) {
      return { session, sets, found };
    }
  }
  return null;
}

const setsOfSession = (sessionId: string): Row[] => {
  const session = sessionDetailBackend.sessions.find((entry) => entry["id"] === sessionId);
  return rowsOf(session?.["workout_sets"]);
};

function putSets(session: Row, sets: Row[]): void {
  session["workout_sets"] = sets;
}

function oneSet(row: Row | undefined, init?: RequestInit): Response {
  if (row === undefined) {
    return wantsOneObject(init)
      ? jsonResponse({ code: "PGRST116", message: "no rows", details: null, hint: null }, 406)
      : jsonResponse([]);
  }
  return wantsOneObject(init) ? jsonResponse(row) : jsonResponse([row]);
}

function setWrites(url: URL, init?: RequestInit): Response | null {
  const method = (init?.method ?? "GET").toUpperCase();
  const idFilter = url.searchParams.get("id");
  const id = idFilter === null ? null : idFilter.replace("eq.", "");

  if (method === "GET" && url.searchParams.get("session_id")?.startsWith("eq.")) {
    const live = setsOfSession(url.searchParams.get("session_id")?.replace("eq.", "") ?? "");
    return jsonResponse([], 200, { "content-range": `*/${live.length}` });
  }
  if (method === "GET" && id !== null) {
    const live = findLiveSet(id)?.found;
    return oneSet(live ?? historyEditBackend.removedSets.find((row) => row["id"] === id), init);
  }
  if (method !== "PATCH" || id === null) {
    return null;
  }
  if (historyEditBackend.failingWrites) {
    return databaseError();
  }
  const body = bodyOf(init);
  if ("deleted_at" in body && body["deleted_at"] !== null) {
    historyEditBackend.removedIds.push(id);
    const live = findLiveSet(id);
    if (live === null) {
      return oneSet(undefined, init);
    }
    const removed = { ...live.found, deleted_at: body["deleted_at"] };
    putSets(
      live.session,
      live.sets.filter((row) => row["id"] !== id),
    );
    historyEditBackend.removedSets.push(removed);
    return oneSet(removed, init);
  }
  if ("deleted_at" in body) {
    historyEditBackend.restoredIds.push(id);
    const removed = historyEditBackend.removedSets.find((row) => row["id"] === id);
    if (removed === undefined) {
      return oneSet(undefined, init);
    }
    const restored = { ...removed, deleted_at: null };
    const session = sessionDetailBackend.sessions.find(
      (entry) => entry["id"] === removed["session_id"],
    );
    if (session !== undefined) {
      putSets(session, [...rowsOf(session["workout_sets"]), restored].sort(byPosition));
    }
    historyEditBackend.removedSets = historyEditBackend.removedSets.filter(
      (row) => row["id"] !== id,
    );
    return oneSet(restored, init);
  }
  historyEditBackend.updates.push(body);
  const live = findLiveSet(id);
  if (live === null) {
    return oneSet(undefined, init);
  }
  const updated = { ...live.found, ...body };
  putSets(
    live.session,
    live.sets.map((row) => (row["id"] === id ? updated : row)),
  );
  return oneSet(updated, init);
}

const byPosition = (first: Row, second: Row): number =>
  Number(first["position"]) - Number(second["position"]);

/** The fake database: the writes above, the session detail's read of one session, and the history list's reads. */
export async function historyEditFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(address);
  const method = (init?.method ?? "GET").toUpperCase();
  // The history list reads the sessions the detail holds, so what the detail changes the list shows.
  historyBackend.sessions = sessionDetailBackend.sessions;
  trainBackend.weekSessions = sessionDetailBackend.sessions;

  if (url.pathname.endsWith("/workout_sets")) {
    if (method === "PATCH") {
      await historyEditBackend.holdWrites;
    }
    const written = setWrites(url, init);
    if (written !== null) {
      return written;
    }
  }
  if (method === "POST" && url.pathname.endsWith("/rpc/delete_workout_session")) {
    if (historyEditBackend.failingWrites) {
      return databaseError();
    }
    const sessionId = String(bodyOf(init)["p_session_id"]);
    historyEditBackend.deletedSessionIds.push(sessionId);
    sessionDetailBackend.sessions = sessionDetailBackend.sessions.filter(
      (session) => session["id"] !== sessionId,
    );
    historyBackend.sessions = sessionDetailBackend.sessions;
    trainBackend.weekSessions = sessionDetailBackend.sessions;
    return new Response(null, { status: 204 });
  }
  const isSessionById =
    method === "GET" &&
    url.pathname.endsWith("/workout_sessions") &&
    url.searchParams.has("id") &&
    (url.searchParams.get("select") ?? "").includes("workout_sets(");
  return isSessionById ? sessionDetailFetch(input, init) : historyFetch(input, init);
}

/** A real Supabase client whose network is the fake database above. */
export const historyEditClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: historyEditFetch },
});
