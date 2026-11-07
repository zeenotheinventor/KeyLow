import { createClient } from "@supabase/supabase-js";

import type { Database } from "@keylow/api-client";

/** The undo route's codes for one action id. */
type UndoCode = "undone" | "already_undone" | "undo_unavailable" | "not_found";

/** What the `assistant` function's undo route holds and how it answers, which a test changes between renders. */
export const undoBackend: {
  /** The code each action id gets. An id not listed is undone. */
  codes: Record<string, UndoCode>;
  /** The reason the route gives for an action id it refused, for the ids listed. */
  reasons: Record<string, string>;
  /** Makes every request fail with a server error whose body quotes a value. */
  fails: boolean;
  /** Holds every request until it settles. */
  gate: Promise<void> | undefined;
  bodies: unknown[];
} = { codes: {}, reasons: {}, fails: false, gate: undefined, bodies: [] };

export function resetUndoBackend(): void {
  undoBackend.codes = {};
  undoBackend.reasons = {};
  undoBackend.fails = false;
  undoBackend.gate = undefined;
  undoBackend.bodies = [];
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function answerUndo(body: unknown): Promise<Response> {
  const sent: unknown = typeof body === "string" ? JSON.parse(body) : body;
  undoBackend.bodies.push(sent);
  await undoBackend.gate;

  if (undoBackend.fails) {
    return jsonResponse({ error: { code: "internal", message: "raw database text" } }, 500);
  }
  const actionIds =
    typeof sent === "object" &&
    sent !== null &&
    "actionIds" in sent &&
    Array.isArray(sent.actionIds)
      ? sent.actionIds.filter((id): id is string => typeof id === "string")
      : [];

  return jsonResponse({
    results: actionIds.map((actionId) => ({
      actionId,
      result: undoBackend.codes[actionId] ?? "undone",
      ...(undoBackend.reasons[actionId] === undefined
        ? {}
        : { reason: undoBackend.reasons[actionId] }),
    })),
  });
}

function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (new URL(address).pathname.endsWith("/functions/v1/assistant/undo")) {
    return answerUndo(init?.body);
  }

  return Promise.resolve(jsonResponse({ message: "unexpected request" }, 404));
}

/** A real Supabase client whose network is the undo route above. */
export const undoClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});
