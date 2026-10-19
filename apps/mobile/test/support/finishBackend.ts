import { createClient } from "@supabase/supabase-js";
import { onlineManager } from "@tanstack/react-query";

import { trainBackend, trainFetch } from "./trainBackend";
import { writesFetch } from "./trainWritesBackend";

import type { Database } from "@keylow/api-client";

type Row = Record<string, unknown>;

/**
 * What the finishing of a session did and how it answers, which a test changes between renders. The reads
 * are `trainBackend`'s, and a finish takes the open session away and puts it in the week and the history
 * with its end and note, as the database would. The client below also answers the start and the discard of
 * a session (`trainWritesBackend`). The set writes and the exercise reads are `trainBackend`'s own, so the
 * whole loop runs on one fake database.
 */
export const finishWrites: {
  /** The updates the finishes sent, as sent: the end and the note. */
  patched: Row[];
  /** Holds every update until this settles, so a test can press again while the first save is pending. */
  holdPatches: Promise<void> | null;
  /** Fails the updates with a database error. */
  failPatches: boolean;
} = {
  patched: [],
  holdPatches: null,
  failPatches: false,
};

/** The session as a finish stored it, for the reads that follow it. */
let finishedSession: Row | null = null;

export function resetFinishWrites(): void {
  finishedSession = null;
  finishWrites.patched = [];
  finishWrites.holdPatches = null;
  finishWrites.failPatches = false;
}

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const databaseError = (): Response =>
  jsonResponse({ code: "XX000", message: "raw database text", details: null, hint: null }, 500);

/** The request's JSON body, or nothing when it has none. */
function jsonBodyOf(init: RequestInit | undefined): Row {
  const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
  return typeof body === "object" && body !== null ? { ...body } : {};
}

async function finishFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(address);
  const method = init?.method ?? "GET";
  const isSessionTable = url.pathname.endsWith("/workout_sessions");
  const open = trainBackend.activeSession;
  const stored = finishedSession ?? open;

  if (method === "PATCH" && isSessionTable && open !== null) {
    await finishWrites.holdPatches;
    if (!onlineManager.isOnline()) {
      throw new TypeError("Network request failed");
    }
    if (finishWrites.failPatches) {
      return databaseError();
    }
    const body = jsonBodyOf(init);
    finishWrites.patched.push(body);
    finishedSession = { ...open, ended_at: body["ended_at"], note: body["note"] };
    trainBackend.activeSession = null;
    trainBackend.weekSessions = [...trainBackend.weekSessions, finishedSession];
    trainBackend.sessions = [finishedSession];
    return new Response(null, { status: 204 });
  }
  if (method === "GET" && isSessionTable && url.searchParams.has("id") && stored !== null) {
    // The read of the session's start and end, which asks for one row as an object.
    if (url.searchParams.get("select") === "started_at,ended_at") {
      return jsonResponse({ started_at: stored["started_at"], ended_at: stored["ended_at"] }, 200);
    }
    return jsonResponse([stored], 200);
  }
  if (isSessionTable && method === "POST") {
    return writesFetch(input, init);
  }
  if (url.pathname.includes("/rpc/")) {
    return writesFetch(input, init);
  }
  return trainFetch(input, init);
}

/** A real Supabase client whose network is the fake database, with the whole loop's writes. */
export const finishClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: finishFetch },
});
