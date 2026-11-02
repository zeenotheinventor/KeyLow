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
