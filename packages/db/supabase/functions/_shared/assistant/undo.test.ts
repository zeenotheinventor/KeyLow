import { assertEquals, assertObjectMatch } from "@std/assert";

import { executeTool } from "./executor.ts";
import {
  createFakeActionStore,
  createFakeContext,
  fakeWriteTool,
  otherUserId,
  spyOnConsole,
  userId,
} from "./testing.ts";
import { stubCaller } from "./tools/testing.ts";
import { sessionRow } from "./tools/trainingFixtures.ts";
import { undoAction } from "./undo.ts";

import type { FakeToolOptions } from "./testing.ts";

const input = { note: "lunch" };

// Runs a write and returns the context and the id of the action it recorded.
async function writeThenContext(options: FakeToolOptions = {}) {
  const write = fakeWriteTool(options);
  const made = createFakeContext([write.definition]);
  const result = await executeTool(made.ctx, "fake_write", input);
  if (result.status !== "ok" || result.actionId === null) {
    throw new Error("expected a recorded action");
  }
  return { ...made, actionId: result.actionId, write };
}

Deno.test("undo runs the tool's inverse for the caller's own action and records when", async () => {
  const seen: unknown[] = [];
  const { ctx, store, actionId } = await writeThenContext({
    run: () =>
      Promise.resolve({
        target: { targetId: "row-1", targetUpdatedAt: "2026-11-02T10:00:00.000Z" },
      }),
    inverse: (_ctx, action) => {
      seen.push(action);
      return Promise.resolve("undone");
    },
  });

  const result = await undoAction(ctx, actionId);

  assertEquals(result, { status: "undone", actionId });
  assertObjectMatch(seen[0] ?? {}, {
    targetId: "row-1",
    targetUpdatedAt: "2026-11-02T10:00:00.000Z",
  });
  assertEquals(store.actions[0]?.undoneAt === null, false);
});

Deno.test("a second undo answers already_undone and the inverse ran once", async () => {
  let inverses = 0;
  const { ctx, actionId } = await writeThenContext({
    inverse: () => {
      inverses += 1;
      return Promise.resolve("undone");
    },
  });

  await undoAction(ctx, actionId);
  const second = await undoAction(ctx, actionId);

  assertEquals(second, { status: "error", code: "already_undone" });
  assertEquals(inverses, 1);
});

Deno.test("two undos at once run the inverse once", async () => {
  let inverses = 0;
  const { ctx, actionId } = await writeThenContext({
    inverse: async () => {
      inverses += 1;
      await new Promise((resolve) => setTimeout(resolve, 0));
      return "undone";
    },
  });

  const results = await Promise.all([undoAction(ctx, actionId), undoAction(ctx, actionId)]);

  assertEquals(inverses, 1);
  assertEquals(results.filter((result) => result.status === "undone").length, 1);
});

Deno.test("undo of another user's action finds nothing and runs nothing", async () => {
  let inverses = 0;
  const { ctx, store, actionId } = await writeThenContext({
    inverse: () => {
      inverses += 1;
      return Promise.resolve("undone");
    },
  });
  const intruder = { ...ctx, userId: otherUserId };

  const result = await undoAction(intruder, actionId);

  assertEquals(result, { status: "error", code: "not_found" });
  assertEquals(inverses, 0);
  assertEquals(store.actions[0]?.undoneAt, null);
});

Deno.test("an action id nobody has finds nothing", async () => {
  const { ctx } = createFakeContext([]);

  assertEquals(await undoAction(ctx, "nope"), { status: "error", code: "not_found" });
});

Deno.test(
  "a write that declares no inverse answers undo_unavailable and is not marked undone",
  async () => {
    const { ctx, store, actionId } = await writeThenContext({ inverse: null });

    const result = await undoAction(ctx, actionId);

    assertEquals(result, { status: "error", code: "undo_unavailable" });
    assertEquals(store.actions[0]?.undoneAt, null);
  },
);

Deno.test(
  "an inverse that finds the target changed answers undo_unavailable and can be tried again",
  async () => {
    let changed = true;
    const { ctx, store, actionId } = await writeThenContext({
      inverse: () => Promise.resolve(changed ? "unavailable" : "undone"),
    });

    const first = await undoAction(ctx, actionId);
    changed = false;
    const second = await undoAction(ctx, actionId);

    assertEquals(first, { status: "error", code: "undo_unavailable" });
    assertEquals(second, { status: "undone", actionId });
    assertEquals(store.actions[0]?.undoneAt === null, false);
  },
);

Deno.test(
  "an inverse that throws gives the claim back, reports the tool and a code, and logs nothing",
  async () => {
    const spy = spyOnConsole();
    const { ctx, store, actionId, reported } = await writeThenContext({
      inverse: () => Promise.reject(new Error("Chicken 82.4 kg")),
    });

    let result;
    try {
      result = await undoAction(ctx, actionId);
    } finally {
      spy.restore();
    }

    assertEquals(result, { status: "error", code: "undo_failed" });
    assertEquals(store.actions[0]?.undoneAt, null);
    assertEquals(
      reported.map(({ functionName, code }) => [functionName, code]),
      [["assistant tool fake_write", "internal_error"]],
    );
    assertEquals(spy.lines, []);
  },
);

Deno.test("an action whose tool is no longer registered answers undo_unavailable", async () => {
  const { ctx, actionId } = await writeThenContext();
  const withoutTools = { ...ctx, registry: createFakeContext([]).ctx.registry };

  assertEquals(await undoAction(withoutTools, actionId), {
    status: "error",
    code: "undo_unavailable",
  });
});

Deno.test("a slot that was only reserved has nothing to undo", async () => {
  const store = createFakeActionStore();
  const write = fakeWriteTool();
  const { ctx } = createFakeContext([write.definition], { store });
  const reserved = await store.insertReservation({
    userId,
    conversationId: ctx.turn.conversationId,
    turnId: ctx.turn.id,
    turnSeq: 1,
    tool: "fake_write",
    targetTable: "log_entries",
  });
  if (reserved.outcome !== "reserved") {
    throw new Error("expected a slot");
  }

  assertEquals(await undoAction(ctx, reserved.actionId), {
    status: "error",
    code: "undo_unavailable",
  });
});

// The guard that keeps the Undo of a training write out of a workout in progress (KEY-899).
const workoutInProgress = () =>
  stubCaller({ tables: { workout_sessions: [sessionRow(1, { ended_at: null })] } });
const noWorkoutInProgress = () => stubCaller({ tables: { workout_sessions: [sessionRow(1)] } });

// A flagged write that landed while no workout was in progress.
async function flaggedWriteThenContext(inverse: () => Promise<"undone">) {
  const write = fakeWriteTool({ refusesDuringWorkout: true, inverse });
  const made = createFakeContext([write.definition]);
  const result = await executeTool(
    { ...made.ctx, caller: noWorkoutInProgress().caller },
    "fake_write",
    input,
  );
  if (result.status !== "ok" || result.actionId === null) {
    throw new Error("expected a recorded action");
  }
  return { ...made, actionId: result.actionId };
}

Deno.test(
  "undo of a flagged write during a workout answers undo_unavailable with the reason, takes no claim and works after the workout",
  async () => {
    let inverses = 0;
    const { ctx, store, actionId } = await flaggedWriteThenContext(() => {
      inverses += 1;
      return Promise.resolve("undone");
    });

    const during = await undoAction({ ...ctx, caller: workoutInProgress().caller }, actionId);

    assertEquals(during, {
      status: "error",
      code: "undo_unavailable",
      reason: "workout_in_progress",
    });
    assertEquals(inverses, 0);
    assertEquals(store.actions[0]?.undoneAt, null);
    assertEquals(store.calls["claimUndo"], undefined);

    const after = await undoAction({ ...ctx, caller: noWorkoutInProgress().caller }, actionId);

    assertEquals(after, { status: "undone", actionId });
    assertEquals(inverses, 1);
    assertEquals(store.actions[0]?.undoneAt === null, false);
  },
);

Deno.test("undo of a write without the flag ignores a live workout", async () => {
  const { ctx, actionId } = await writeThenContext();
  const live = workoutInProgress();

  const result = await undoAction({ ...ctx, caller: live.caller }, actionId);

  assertEquals(result, { status: "undone", actionId });
  assertEquals(live.calls, []);
});

Deno.test(
  "undo of a flagged write whose session read fails answers undo_failed, reports it and takes no claim",
  async () => {
    const { ctx, store, actionId, reported } = await flaggedWriteThenContext(() =>
      Promise.resolve("undone"),
    );
    const broken = stubCaller({ failingTables: { workout_sessions: "57014" } });

    const result = await undoAction({ ...ctx, caller: broken.caller }, actionId);

    assertEquals(result, { status: "error", code: "undo_failed" });
    assertEquals(store.actions[0]?.undoneAt, null);
    assertEquals(store.calls["claimUndo"], undefined);
    assertEquals(
      reported.map(({ functionName, code }) => [functionName, code]),
      [["assistant tool fake_write", "internal_error"]],
    );
  },
);

Deno.test("an inverse that gives a reason has it passed on with undo_unavailable", async () => {
  const { ctx, store, actionId } = await writeThenContext({
    inverse: () => Promise.resolve({ status: "unavailable", reason: "changed" }),
  });

  const result = await undoAction(ctx, actionId);

  assertEquals(result, { status: "error", code: "undo_unavailable", reason: "changed" });
  assertEquals(store.actions[0]?.undoneAt, null);
});

Deno.test("an inverse that gives no reason leaves the reason out", async () => {
  const { ctx, actionId } = await writeThenContext({
    inverse: () => Promise.resolve("unavailable"),
  });

  const result = await undoAction(ctx, actionId);

  assertEquals(result, { status: "error", code: "undo_unavailable" });
});

// An inverse that needs the old value and answers `unavailable` without it, as the training tools do.
const needsPreviousValue: FakeToolOptions["inverse"] = async (ctx, action) =>
  (await ctx.previousValueOf(action)) === null ? "unavailable" : "undone";

Deno.test("an inverse is handed the previous value stored for its action", async () => {
  const { ctx, store, actionId } = await writeThenContext({ inverse: needsPreviousValue });
  store.previousValues.set(actionId, { name: "Push day" });

  const result = await undoAction(ctx, actionId);

  assertEquals(result, { status: "undone", actionId });
});

Deno.test(
  "an inverse that is handed null answers unavailable and the action stays undoable",
  async () => {
    const { ctx, store, actionId } = await writeThenContext({ inverse: needsPreviousValue });

    const result = await undoAction(ctx, actionId);

    assertEquals(result, { status: "error", code: "undo_unavailable" });
    assertEquals(store.actions[0]?.undoneAt, null);
  },
);
