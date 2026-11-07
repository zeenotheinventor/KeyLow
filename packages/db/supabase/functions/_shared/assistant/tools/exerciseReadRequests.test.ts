// The reads the custom exercise tools make, sent by a real supabase-js client to a `fetch` that records the
// request. The in-memory stub accepts forms the client never sends, so this is where the query string is
// pinned: a filter that a real server would refuse cannot pass here.
import { assertEquals } from "@std/assert";
import { createClient } from "@supabase/supabase-js";

import { createFakeContext } from "../testing.ts";
import { isExerciseInUse, plannedOn } from "./exerciseWrite.ts";

import type { Database } from "../../core/database.types.ts";
import type { ToolContext } from "../tool.ts";

const exerciseId = "00000000-0000-4000-8000-000000000011";

// A client whose requests are recorded, and answered with no rows.
function recordingContext() {
  const urls: URL[] = [];
  const caller = createClient<Database>("http://127.0.0.1:54321", "anon-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input) => {
        urls.push(new URL(input instanceof Request ? input.url : String(input)));
        return Promise.resolve(
          new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
        );
      },
    },
  });
  const { ctx } = createFakeContext([], { localDate: "2026-11-03" });
  const context: ToolContext = { ...ctx, caller };
  return { context, urls };
}

const queryOf = (url: URL) => Object.fromEntries(url.searchParams);

Deno.test("the accepted suggestion read sends the containment as a JSON string", async () => {
  const { context, urls } = recordingContext();

  await plannedOn(context, exerciseId);

  const suggestion = urls.find((url) => url.pathname.endsWith("/accepted_suggestions"));
  assertEquals(suggestion === undefined ? null : queryOf(suggestion), {
    select: "id",
    deleted_at: "is.null",
    local_date: "gte.2026-11-03",
    exercises: `cs.[{"exercise_id":"${exerciseId}"}]`,
    limit: "1",
  });
});

Deno.test("the routine read sends the embed and the exercise filter", async () => {
  const { context, urls } = recordingContext();

  await plannedOn(context, exerciseId);

  const routine = urls.find((url) => url.pathname.endsWith("/routine_exercises"));
  assertEquals(routine === undefined ? null : queryOf(routine), {
    select: "id,routine_days(routines(is_archived))",
    exercise_id: `eq.${exerciseId}`,
  });
});

Deno.test(
  "the use check reads the plan, the sets and the accepted suggestions the same way",
  async () => {
    const { context, urls } = recordingContext();

    await isExerciseInUse(context, exerciseId);

    const byTable = Object.fromEntries(
      urls.map((url) => [url.pathname.split("/").at(-1), queryOf(url)]),
    );
    assertEquals(byTable["routine_exercises"], {
      select: "id",
      exercise_id: `eq.${exerciseId}`,
      limit: "1",
    });
    assertEquals(byTable["workout_sets"], {
      select: "id",
      exercise_id: `eq.${exerciseId}`,
      limit: "1",
    });
    assertEquals(
      byTable["accepted_suggestions"]?.["exercises"],
      `cs.[{"exercise_id":"${exerciseId}"}]`,
    );
  },
);
