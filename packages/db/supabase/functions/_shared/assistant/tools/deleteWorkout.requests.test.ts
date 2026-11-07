// What `delete_workout` sends to PostgREST, seen from a real supabase-js client with a capturing `fetch`. The
// in-memory stub of the other tests accepts a filter or an embed whatever its form (KEY-905 found a `.contains`
// it accepted that the real client turns into `{[object Object]}`), so these are the requests as they would go
// out. The answers are canned. The database itself is covered by the integration test of the `db` job.
import { createClient } from "@supabase/supabase-js";
import { assert, assertEquals, assertStringIncludes } from "@std/assert";

import { createFakeContext } from "../testing.ts";
import { deleteWorkoutTool } from "./deleteWorkout.ts";
import { exerciseId, sessionRow, setRow } from "./trainingFixtures.ts";

import type { Database } from "../../core/database.types.ts";
import type { ActionRecord } from "../store.ts";
import type { ToolContext } from "../tool.ts";

const sessionId = "00000000-0000-4000-8000-0000000b0001";
// With microseconds and a plus sign, which is how PostgREST writes a timestamptz and what a URL can break.
const deletedAt = "2026-11-07T10:00:01.123456+00:00";
const origin = "http://127.0.0.1:54321";

type Captured = {
  method: string;
  path: string;
  search: URLSearchParams;
  rawSearch: string;
  body: string;
};

// A finished Legs workout with one set, and a session row that says whether it is deleted.
function capturingCaller(state: { deleted: boolean }) {
  const requests: Captured[] = [];
  const squat = { id: exerciseId(7), name: "Barbell squat", equipment: "barbell" };
  const finished = sessionRow(1, {
    id: sessionId,
    local_date: "2026-10-08",
    routine_days: { name: "Legs" },
    workout_sets: [setRow(1, squat, { session_id: sessionId })],
  });
  const respond = (request: Captured): Response => {
    const json = (body: unknown) => Response.json(body);
    const { method, path, search } = request;
    if (method === "POST" && path === "/rest/v1/rpc/delete_workout_session") {
      state.deleted = true;
      return new Response(null, { status: 204 });
    }
    if (method === "GET" && path === "/rest/v1/workout_sessions") {
      const select = search.get("select") ?? "";
      if (select === "deleted_at") {
        return json([{ deleted_at: state.deleted ? deletedAt : null }]);
      }
      // The session read filters out a deleted session, as the database does.
      return json(search.get("deleted_at") === "is.null" && state.deleted ? [] : [finished]);
    }
    if (method === "PATCH" && path === "/rest/v1/workout_sessions") {
      state.deleted = false;
      return json([{ id: sessionId }]);
    }
    return new Response(null, { status: 204 });
  };
  const client = createClient<Database>(origin, "anon-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        const captured: Captured = {
          method: request.method,
          path: url.pathname,
          search: url.searchParams,
          rawSearch: url.search,
          body: await request.text(),
        };
        requests.push(captured);
        return respond(captured);
      },
    },
  });
  const ctx: ToolContext = { ...createFakeContext([deleteWorkoutTool]).ctx, caller: client };
  return { ctx, requests };
}

const readsOf = (requests: Captured[], select: (value: string) => boolean) =>
  requests.filter(
    ({ method, path, search }) =>
      method === "GET" &&
      path === "/rest/v1/workout_sessions" &&
      select(search.get("select") ?? ""),
  );

Deno.test(
  "the session read of the question filters the session and its embedded sets by deleted_at",
  async () => {
    const { ctx, requests } = capturingCaller({ deleted: false });

    const need = await deleteWorkoutTool.needsConfirmation?.({ session_id: sessionId }, ctx);

    assert(need !== undefined && need !== false);
    assertEquals(
      need.question.startsWith("Delete your Legs workout from Thursday 8 October? It has 1 set."),
      true,
    );
    const [read] = readsOf(requests, (select) => select.includes("workout_sets("));
    assert(read !== undefined);
    assertEquals(read.search.get("id"), `eq.${sessionId}`);
    assertEquals(read.search.get("deleted_at"), "is.null");
    // The embedded filter that keeps a removed set out of the count. The stub ignores it.
    assertEquals(read.search.get("workout_sets.deleted_at"), "is.null");
    assertEquals(
      requests.every(({ method }) => method === "GET"),
      true,
    );
  },
);

Deno.test(
  "the delete is one rpc call with the session id, and the stamp is read back with no deleted_at filter",
  async () => {
    const { ctx, requests } = capturingCaller({ deleted: false });

    const output = await deleteWorkoutTool.run(ctx, { session_id: sessionId });

    const rpc = requests.filter(({ method }) => method === "POST");
    assertEquals(rpc.length, 1);
    assertEquals(rpc[0]?.path, "/rest/v1/rpc/delete_workout_session");
    assertEquals(JSON.parse(rpc[0]?.body ?? "null"), { p_session_id: sessionId });
    // Only the rpc wrote.
    assertEquals(requests.filter(({ method }) => method !== "GET").length, 1);
    const [stampRead] = readsOf(requests, (select) => select === "deleted_at");
    assert(stampRead !== undefined);
    assertEquals(stampRead.search.get("id"), `eq.${sessionId}`);
    // A filter on a live session would read nothing back from the session the delete has just stamped.
    assertEquals(stampRead.search.has("deleted_at"), false);
    assertEquals(output.target, { targetId: sessionId, targetUpdatedAt: deletedAt });
  },
);

Deno.test(
  "Undo restores by the stamp, URL encoded so the plus sign survives, on the session and on its sets only",
  async () => {
    const { ctx, requests } = capturingCaller({ deleted: true });
    const action: ActionRecord = {
      id: "action-1",
      userId: ctx.userId,
      conversationId: null,
      turnId: null,
      turnSeq: 1,
      tool: "delete_workout",
      targetTable: "workout_sessions",
      targetId: sessionId,
      targetIds: null,
      targetLocalDate: null,
      targetUpdatedAt: deletedAt,
      undoneAt: null,
    };

    const outcome = await deleteWorkoutTool.inverse?.(ctx, action);

    assertEquals(outcome, "undone");
    const patches = requests.filter(({ method }) => method === "PATCH");
    assertEquals(
      patches.map(({ path }) => path),
      ["/rest/v1/workout_sessions", "/rest/v1/workout_sets"],
    );
    const [sessionPatch, setsPatch] = patches;
    assertEquals(JSON.parse(sessionPatch?.body ?? "null"), { deleted_at: null });
    assertEquals(sessionPatch?.search.get("id"), `eq.${sessionId}`);
    assertEquals(sessionPatch?.search.get("deleted_at"), `eq.${deletedAt}`);
    assertEquals(JSON.parse(setsPatch?.body ?? "null"), { deleted_at: null });
    assertEquals(setsPatch?.search.get("session_id"), `eq.${sessionId}`);
    // A set removed on its own has another stamp, so only this one is brought back.
    assertEquals(setsPatch?.search.get("deleted_at"), `eq.${deletedAt}`);
    assertStringIncludes(sessionPatch?.rawSearch ?? "", "%2B00%3A00");
    assertStringIncludes(setsPatch?.rawSearch ?? "", "%2B00%3A00");
    // Nothing in the requests is a Date's rendering of the stamp.
    assertEquals(
      requests.some(({ rawSearch }) => rawSearch.includes("123Z")),
      false,
    );
  },
);
