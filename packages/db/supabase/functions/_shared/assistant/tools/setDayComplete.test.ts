import { assert, assertEquals, assertObjectMatch } from "@std/assert";

import { executeTool } from "../executor.ts";
import { userId } from "../testing.ts";
import { undoAction } from "../undo.ts";
import { payloadOf } from "./testing.ts";
import { setDayCompleteTool } from "./setDayComplete.ts";
import { structuredOf, writeContext } from "./writeFixtures.ts";

const day = "2026-11-03";
const dayLogOf = (isComplete: boolean) => ({
  user_id: userId,
  local_date: day,
  is_complete: isComplete,
  completed_at: isComplete ? "2026-11-03T20:00:00.000000+00:00" : null,
  note: null,
});
const setUp = (dayLogs: Record<string, unknown>[] = []) =>
  writeContext([setDayCompleteTool], { rows: { day_logs: dayLogs } });
const dayLogs = (stub: ReturnType<typeof setUp>["stub"]) => stub.tables["day_logs"] ?? [];

Deno.test(
  "marking a day complete writes its day log and builds the Diary's own words",
  async () => {
    const { ctx, stub, store } = setUp();

    const result = await executeTool(ctx, "set_day_complete", { local_date: day, complete: true });

    assertEquals(result.status, "ok");
    assertEquals(payloadOf(result), { local_date: day, complete: true, changed: true });
    assertObjectMatch(structuredOf(result), {
      card: {
        kind: "day_completed",
        title: "Day complete",
        sub: "Tuesday 3 November",
        undo: "available",
      },
    });
    assertObjectMatch(dayLogs(stub)[0] ?? {}, { local_date: day, is_complete: true });
    const [action] = store.actions;
    assertEquals(action?.tool, "set_day_complete");
    assertEquals(action?.targetTable, "day_logs");
    assertEquals(action?.targetLocalDate, day);
    assertEquals(action?.targetId, null);
    assertEquals(action?.targetUpdatedAt, dayLogs(stub)[0]?.["completed_at"]);
  },
);

Deno.test("a day already in the state asked for changes nothing and leaves no action", async () => {
  const complete = setUp([dayLogOf(true)]);
  const incomplete = setUp();

  const again = await executeTool(complete.ctx, "set_day_complete", {
    local_date: day,
    complete: true,
  });
  const never = await executeTool(incomplete.ctx, "set_day_complete", {
    local_date: day,
    complete: false,
  });

  for (const result of [again, never]) {
    assertEquals(result.status, "ok");
    assertEquals(structuredOf(result), {});
    assertEquals(result.status === "ok" && result.actionId, null);
  }
  assertObjectMatch(payloadOf(again) as object, { changed: false });
  assertEquals(complete.store.actions.length, 0);
  assertEquals(incomplete.store.actions.length, 0);
  assertEquals(dayLogs(incomplete.stub), []);
});

Deno.test(
  "marking a day incomplete words it plainly, and its Undo marks it complete again",
  async () => {
    const { ctx, stub } = setUp([dayLogOf(true)]);

    const result = await executeTool(ctx, "set_day_complete", { local_date: day, complete: false });
    assert(result.status === "ok" && result.actionId !== null);

    assertObjectMatch(structuredOf(result), {
      card: { title: "Day marked incomplete", undoneSub: "Day complete" },
    });
    assertEquals(dayLogs(stub)[0]?.["is_complete"], false);
    assertEquals(await undoAction(ctx, result.actionId), {
      status: "undone",
      actionId: result.actionId,
    });
    assertEquals(dayLogs(stub)[0]?.["is_complete"], true);
  },
);

Deno.test("undo flips a completed day back", async () => {
  const { ctx, stub } = setUp();
  const result = await executeTool(ctx, "set_day_complete", { local_date: day, complete: true });
  assert(result.status === "ok" && result.actionId !== null);

  const undone = await undoAction(ctx, result.actionId);

  assertEquals(undone, { status: "undone", actionId: result.actionId });
  assertEquals(dayLogs(stub)[0]?.["is_complete"], false);
  assertEquals(dayLogs(stub)[0]?.["completed_at"], null);
});

Deno.test("undo is unavailable when the person has changed the day since", async () => {
  const completed = setUp();
  const first = await executeTool(completed.ctx, "set_day_complete", {
    local_date: day,
    complete: true,
  });
  assert(first.status === "ok" && first.actionId !== null);
  // The person unmarks the day in the Diary, so flipping it again would complete it.
  await completed.stub.caller
    .from("day_logs")
    .update({ is_complete: false, completed_at: null })
    .eq("local_date", day);

  const incompleted = setUp([dayLogOf(true)]);
  const second = await executeTool(incompleted.ctx, "set_day_complete", {
    local_date: day,
    complete: false,
  });
  assert(second.status === "ok" && second.actionId !== null);
  // The person marks it complete again, so flipping it would complete a day that already is.
  await incompleted.stub.caller
    .from("day_logs")
    .update({ is_complete: true, completed_at: "2026-11-03T21:00:00.000000+00:00" })
    .eq("local_date", day);

  assertEquals(await undoAction(completed.ctx, first.actionId), {
    status: "error",
    code: "undo_unavailable",
  });
  assertEquals(await undoAction(incompleted.ctx, second.actionId), {
    status: "error",
    code: "undo_unavailable",
  });
  assertEquals(dayLogs(completed.stub)[0]?.["is_complete"], false);
});

Deno.test(
  "a completed_at that cannot be read back leaves Undo unavailable, never a wrong flip",
  async () => {
    const { ctx, stub, store, reported } = setUp();
    // The first read of the day log is the one before the write. The next is the read-back.
    stub.failNextReadFrom("day_logs", 1);

    const result = await executeTool(ctx, "set_day_complete", { local_date: day, complete: true });
    assert(result.status === "ok" && result.actionId !== null);

    assertEquals(store.actions[0]?.targetUpdatedAt === null, false);
    assertEquals(
      reported.map((failure) => failure.code),
      ["internal_error"],
    );
    assertEquals(await undoAction(ctx, result.actionId), {
      status: "error",
      code: "undo_unavailable",
    });
    assertEquals(dayLogs(stub)[0]?.["is_complete"], true);
  },
);

Deno.test("a day that is not a date is invalid_input and nothing is written", async () => {
  const { ctx, stub, store } = setUp();

  const result = await executeTool(ctx, "set_day_complete", {
    local_date: "yesterday",
    complete: true,
  });

  assertEquals(payloadOf(result), { error: "invalid_input", fields: ["local_date"] });
  assertEquals(dayLogs(stub), []);
  assertEquals(store.actions.length, 0);
});
