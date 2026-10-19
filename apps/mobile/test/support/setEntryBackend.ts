import { createClient } from "@supabase/supabase-js";

import { trainFetch } from "./trainBackend";

import type { Database } from "@keylow/api-client";

type Row = Record<string, unknown>;

/**
 * What the set writes find in the database, and what they leave there. `addSet` reads the exercise (for the
 * snapshot a set freezes), counts the session's live sets and inserts one row; every other request goes to
 * the training backend. A test sets the exercise and the count, and reads the inserted rows back.
 */
export const setEntryBackend: {
  /** The exercise as the exercise read returns it, with its muscle map. */
  exercise: Row | null;
  /** The live sets the session holds, which an insert adds to. */
  liveSets: number;
  /** The bodies of the inserts, in the order they were made. */
  inserts: Row[];
  /** Fails the inserts with a database error. */
  failInserts: boolean;
  /** Never answers the inserts, as a slow connection does. */
  hangInserts: boolean;
  /** How many inserts were asked for, answered or not. */
  insertAttempts: number;
} = {
  exercise: null,
  liveSets: 0,
  inserts: [],
  failInserts: false,
  hangInserts: false,
  insertAttempts: 0,
};

export function resetSetEntryBackend(): void {
  setEntryBackend.exercise = null;
  setEntryBackend.liveSets = 0;
  setEntryBackend.inserts = [];
  setEntryBackend.failInserts = false;
  setEntryBackend.hangInserts = false;
  setEntryBackend.insertAttempts = 0;
}

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const asksForOneObject = (input: string | URL | Request, init?: RequestInit): boolean =>
  new Headers(input instanceof Request ? input.headers : init?.headers)
    .get("accept")
    ?.includes("vnd.pgrst.object+json") === true;

async function bodyOf(input: string | URL | Request, init?: RequestInit): Promise<Row> {
  const text =
    input instanceof Request
      ? await input.clone().text()
      : typeof init?.body === "string"
        ? init.body
        : "{}";
  const parsed: unknown = JSON.parse(text);
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? Object.fromEntries(Object.entries(parsed))
    : {};
}

let insertedCount = 0;

async function setEntryFetch(input: string | URL | Request, init?: RequestInit) {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(address);
  const table = url.pathname.split("/").pop();
  const method = (input instanceof Request ? input.method : (init?.method ?? "GET")).toUpperCase();

  if (table === "exercises" && method === "GET") {
    const { exercise } = setEntryBackend;
    return exercise === null
      ? jsonResponse({ code: "PGRST116", message: "no rows", details: null, hint: null }, 406)
      : jsonResponse(asksForOneObject(input, init) ? exercise : [exercise]);
  }
  // The count of the session's live sets is the one read of `workout_sets` that names the session with eq.
  if (
    table === "workout_sets" &&
    method === "GET" &&
    url.searchParams.get("session_id")?.startsWith("eq.")
  ) {
    const { liveSets } = setEntryBackend;
    return jsonResponse(liveSets === 0 ? [] : [{ position: liveSets - 1 }], 200, {
      "content-range": liveSets === 0 ? "*/0" : `0-0/${liveSets}`,
    });
  }
  if (table === "workout_sets" && method === "POST") {
    setEntryBackend.insertAttempts += 1;
    if (setEntryBackend.hangInserts) {
      return new Promise<Response>(() => undefined);
    }
    if (setEntryBackend.failInserts) {
      return jsonResponse(
        { code: "XX000", message: "raw database text", details: null, hint: null },
        500,
      );
    }
    const body = await bodyOf(input, init);
    setEntryBackend.inserts.push(body);
    setEntryBackend.liveSets += 1;
    insertedCount += 1;
    const stored = {
      ...body,
      id: `00000009-0000-4000-8000-${String(insertedCount).padStart(12, "0")}`,
      deleted_at: null,
    };
    return jsonResponse(stored, 201);
  }
  return trainFetch(input, init);
}

/** A real Supabase client whose network is the training backend plus the set writes above. */
export const setEntryClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: setEntryFetch },
});
