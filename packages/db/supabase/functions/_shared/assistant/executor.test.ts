import {
  assert,
  assertEquals,
  assertFalse,
  assertObjectMatch,
  assertStringIncludes,
} from "@std/assert";

import { executeTool } from "./executor.ts";
import {
  conversationId,
  createFakeActionStore,
  createFakeContext,
  fakeReadTool,
  fakeWriteTool,
  spyOnConsole,
  turnId,
  turnsOfConversation,
  userId,
} from "./testing.ts";

import type { ExecutionResult } from "./executor.ts";
import type { FakeActionStore } from "./testing.ts";
import type { JsonValue } from "./untrusted.ts";

// What the model would read out of a result's wrapper.
function payloadOf(result: ExecutionResult): unknown {
  const match = /^<untrusted_data source="[a-z0-9_]+">(.*)<\/untrusted_data>$/s.exec(result.text);
  if (match === null || match[1] === undefined) {
    throw new Error("Not a wrapped result");
  }
  return JSON.parse(match[1]);
}

const input = { note: "lunch" };

Deno.test("a read tool runs directly and its result is wrapped, with no slot taken", async () => {
  const read = fakeReadTool("get_day", { data: { totalKcal: 1800 }, structured: { kind: "day" } });
  const { ctx, store } = createFakeContext([read.definition]);

  const result = await executeTool(ctx, "get_day", input);

  assertEquals(result.status, "ok");
  assertStringIncludes(result.text, '<untrusted_data source="get_day">');
  assertEquals(payloadOf(result), { totalKcal: 1800 });
  assertObjectMatch(result, { structured: { kind: "day" }, actionId: null });
  assertEquals(read.runs, [input]);
  assertEquals(store.calls["insertReservation"], undefined);
});

Deno.test(
  "a read tool that throws answers tool_failed and reports only the tool and a code",
  async () => {
    const spy = spyOnConsole();
    const read = fakeReadTool("get_day");
    read.definition.run = () => Promise.reject(new Error("Porridge 82.4 kg for user-1"));
    const { ctx, reported } = createFakeContext([read.definition]);

    let result: ExecutionResult;
    try {
      result = await executeTool(ctx, "get_day", input);
    } finally {
      spy.restore();
    }

    assertObjectMatch(result, { status: "error", code: "tool_failed" });
    assertEquals(reported.length, 1);
    assertEquals(reported[0]?.functionName, "assistant tool get_day");
    assertEquals(reported[0]?.code, "internal_error");
    assertFalse(result.text.includes("82.4"));
    assertEquals(spy.lines, []);
  },
);

Deno.test(
  "an invalid input answers invalid_input with the field names and never throws",
  async () => {
    const read = fakeReadTool("get_day");
    const { ctx } = createFakeContext([read.definition]);

    const result = await executeTool(ctx, "get_day", { note: 12 });

    assertObjectMatch(result, { status: "error", code: "invalid_input" });
    assertEquals(payloadOf(result), { error: "invalid_input", fields: ["note"] });
    assertEquals(read.runs, []);
  },
);

Deno.test("a tool name nobody registered answers unknown_tool", async () => {
  const { ctx } = createFakeContext([], { allowedTools: new Set(["ghost"]) });

  const result = await executeTool(ctx, "ghost", input);

  assertObjectMatch(result, { status: "error", code: "unknown_tool" });
});

Deno.test(
  "a tool outside the allowlist answers tool_not_allowed, never runs and takes no slot",
  async () => {
    const write = fakeWriteTool();
    const { ctx, store } = createFakeContext([write.definition], {
      allowedTools: new Set(["other"]),
    });

    const result = await executeTool(ctx, "fake_write", input);

    assertObjectMatch(result, { status: "error", code: "tool_not_allowed" });
    assertEquals(write.runs, []);
    assertEquals(store.actions.length, 0);
    assertEquals(store.calls["takenSlots"], undefined);
  },
);

Deno.test("an unlisted tool the registry does not know is not allowed, not unknown", async () => {
  const { ctx } = createFakeContext([], { allowedTools: new Set() });

  const result = await executeTool(ctx, "ghost", input);

  assertObjectMatch(result, { status: "error", code: "tool_not_allowed" });
});

Deno.test("the allowlist is checked before the input is validated", async () => {
  const read = fakeReadTool("get_day");
  const { ctx } = createFakeContext([read.definition], { allowedTools: new Set() });

  const result = await executeTool(ctx, "get_day", { note: 12 });

  assertObjectMatch(result, { code: "tool_not_allowed" });
});

Deno.test("a context with no allowlist refuses every tool", async () => {
  const read = fakeReadTool("get_day");
  const write = fakeWriteTool();
  const { ctx, store } = createFakeContext([read.definition, write.definition], {
    allowedTools: undefined,
  });

  for (const name of ["get_day", "fake_write"]) {
    assertObjectMatch(await executeTool(ctx, name, input), { code: "tool_not_allowed" });
  }
  assertEquals([...read.runs, ...write.runs], []);
  assertEquals(store.actions.length, 0);
});

Deno.test(
  "a model-chosen tool name cannot break out of the wrapper's source attribute",
  async () => {
    const { ctx } = createFakeContext([]);

    const result = await executeTool(ctx, '"><b>', input);

    assertStringIncludes(result.text, '<untrusted_data source="unknown">');
  },
);

Deno.test("a write records its target and when it was last changed", async () => {
  const write = fakeWriteTool({
    run: () =>
      Promise.resolve({
        target: { targetId: "row-9", targetUpdatedAt: "2026-11-02T10:00:00.000Z" },
      }),
  });
  const { ctx, store } = createFakeContext([write.definition]);

  const result = await executeTool(ctx, "fake_write", input);

  assertObjectMatch(result, { status: "ok", actionId: "action-1" });
  assertObjectMatch(store.actions[0] ?? {}, {
    userId,
    conversationId,
    turnId,
    turnSeq: 1,
    tool: "fake_write",
    targetTable: "log_entries",
    targetId: "row-9",
    targetUpdatedAt: "2026-11-02T10:00:00.000Z",
  });
});

Deno.test(
  "a multi-row write and a day-level write record their ids and their date on one slot",
  async () => {
    const many = fakeWriteTool({
      name: "copy_day",
      run: () => Promise.resolve({ target: { targetIds: ["a", "b", "c"] } }),
    });
    const day = fakeWriteTool({
      name: "set_day_complete",
      run: () => Promise.resolve({ target: { targetLocalDate: "2026-11-02" } }),
    });
    const { ctx, store } = createFakeContext([many.definition, day.definition]);

    await executeTool(ctx, "copy_day", input);
    await executeTool(ctx, "set_day_complete", input);

    assertEquals(store.actions.length, 2);
    assertObjectMatch(store.actions[0] ?? {}, {
      turnSeq: 1,
      targetIds: ["a", "b", "c"],
      targetId: null,
    });
    assertObjectMatch(store.actions[1] ?? {}, { turnSeq: 2, targetLocalDate: "2026-11-02" });
  },
);

Deno.test("the eleventh write in one turn answers write_limit_reached and never runs", async () => {
  const write = fakeWriteTool();
  const { ctx, store } = createFakeContext([write.definition]);

  for (let call = 0; call < 10; call += 1) {
    assertEquals((await executeTool(ctx, "fake_write", input)).status, "ok");
  }
  const eleventh = await executeTool(ctx, "fake_write", input);

  assertObjectMatch(eleventh, { status: "error", code: "write_limit_reached" });
  assertEquals(write.runs.length, 10);
  assertEquals(store.actions.length, 10);
});

Deno.test("ten parallel writes take ten distinct slots", async () => {
  const write = fakeWriteTool();
  const { ctx, store } = createFakeContext([write.definition]);

  const results = await Promise.all(
    Array.from({ length: 10 }, () => executeTool(ctx, "fake_write", input)),
  );

  assert(results.every((result) => result.status === "ok"));
  assertEquals(
    store.actions.map((action) => action.turnSeq).sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
});

Deno.test("twelve parallel writes run ten and refuse two", async () => {
  const write = fakeWriteTool();
  const { ctx } = createFakeContext([write.definition]);

  const results = await Promise.all(
    Array.from({ length: 12 }, () => executeTool(ctx, "fake_write", input)),
  );

  assertEquals(results.filter((result) => result.status === "ok").length, 10);
  assertEquals(
    results.filter((result) => result.status === "error" && result.code === "write_limit_reached")
      .length,
    2,
  );
  assertEquals(write.runs.length, 10);
});

Deno.test("a write that changed nothing leaves no slot and records no action", async () => {
  const write = fakeWriteTool({ run: () => Promise.resolve({ target: null }) });
  const { ctx, store } = createFakeContext([write.definition]);

  const result = await executeTool(ctx, "fake_write", input);

  assertObjectMatch(result, { status: "ok", actionId: null });
  assertEquals(store.actions.length, 0);
});

Deno.test(
  "a failed write leaves no slot, answers tool_failed and reports the tool and a code",
  async () => {
    const spy = spyOnConsole();
    const write = fakeWriteTool({ run: () => Promise.reject(new Error("Chicken 82.4 kg")) });
    const { ctx, store, reported } = createFakeContext([write.definition]);

    let result: ExecutionResult;
    try {
      result = await executeTool(ctx, "fake_write", input);
    } finally {
      spy.restore();
    }

    assertObjectMatch(result, { status: "error", code: "tool_failed" });
    assertEquals(store.actions.length, 0);
    assertEquals(
      reported.map(({ functionName, code }) => [functionName, code]),
      [["assistant tool fake_write", "internal_error"]],
    );
    assertFalse(result.text.includes("82.4"));
    assertEquals(spy.lines, []);
  },
);

Deno.test("failed writes do not use up the ten", async () => {
  let fail = true;
  const write = fakeWriteTool({
    run: () =>
      fail ? Promise.reject(new Error("boom")) : Promise.resolve({ target: { targetId: "r" } }),
  });
  const { ctx } = createFakeContext([write.definition]);
  for (let call = 0; call < 5; call += 1) {
    await executeTool(ctx, "fake_write", input);
  }
  fail = false;

  const results = [];
  for (let call = 0; call < 10; call += 1) {
    results.push(await executeTool(ctx, "fake_write", input));
  }

  assert(results.every((result) => result.status === "ok"));
});

Deno.test("a write that landed stays recorded when saving its target fails", async () => {
  const write = fakeWriteTool();
  const { ctx, store, reported } = createFakeContext([write.definition]);
  store.fillTarget = () => Promise.reject(new Error("db down"));

  const result = await executeTool(ctx, "fake_write", input);

  assertObjectMatch(result, { status: "ok" });
  assertEquals(write.runs.length, 1);
  assertEquals(store.actions.length, 1);
  assertEquals(
    reported.map(({ code }) => code),
    ["internal_error"],
  );
});

Deno.test(
  "a store that fails while reserving answers tool_failed and the write never runs",
  async () => {
    const write = fakeWriteTool();
    const { ctx, store } = createFakeContext([write.definition]);
    store.takenSlots = () => Promise.reject(new Error("db down"));

    const result = await executeTool(ctx, "fake_write", input);

    assertObjectMatch(result, { code: "tool_failed" });
    assertEquals(write.runs, []);
  },
);

Deno.test("a write in a turn with no user message is refused and takes no slot", async () => {
  for (const userMessageText of [null, "", "   "]) {
    const write = fakeWriteTool();
    const { ctx, store } = createFakeContext([write.definition], { userMessageText });

    const result = await executeTool(ctx, "fake_write", input);

    assertObjectMatch(result, { status: "error", code: "no_user_message" });
    assertEquals(write.runs, []);
    assertEquals(store.actions.length, 0);
  }
});

Deno.test("a read still runs in a turn with no user message", async () => {
  const read = fakeReadTool("get_day");
  const { ctx } = createFakeContext([read.definition], { userMessageText: null });

  assertEquals((await executeTool(ctx, "get_day", input)).status, "ok");
});

const needsYes = { needsConfirmation: () => true };
const earlier = "00000000-0000-4000-8000-0000000000f1";
const middle = "00000000-0000-4000-8000-0000000000f2";
const later = "00000000-0000-4000-8000-0000000000f3";

type WriteTool = ReturnType<typeof fakeWriteTool>;

const contextOn = (
  write: WriteTool,
  store: FakeActionStore,
  turnIdToUse: string,
  inConversation: string = conversationId,
) =>
  createFakeContext([write.definition], {
    store,
    turn: { id: turnIdToUse, conversationId: inConversation },
  }).ctx;

// Asks on turn `earlier` of a conversation that goes on through `laterTurns`, and returns the id the
// model would carry to a later turn.
async function ask(write: WriteTool, laterTurns: string[]) {
  const store = createFakeActionStore({ turns: turnsOfConversation([earlier, ...laterTurns]) });
  const asked = await executeTool(contextOn(write, store, earlier), "fake_write", input);
  if (asked.status !== "needs_confirmation") {
    throw new Error("expected a confirmation request");
  }
  return { store, confirmationId: asked.confirmationId, asked };
}

Deno.test(
  "a write that needs a confirmation stores it on the turn and answers with its id only",
  async () => {
    const write = fakeWriteTool(needsYes);

    const { store, confirmationId, asked } = await ask(write, [later]);

    assertEquals(write.runs, []);
    assertEquals(store.actions.length, 0);
    assertEquals(payloadOf(asked), {
      status: "needs_confirmation",
      confirmation_id: confirmationId,
    });
    const stored = store.turns.find((turn) => turn.id === earlier)?.pending;
    assertObjectMatch(stored ?? {}, { id: confirmationId, tool: "fake_write" });
    assertEquals(stored?.inputHash.length, 64);
    assertFalse(JSON.stringify(stored).includes("lunch"));
  },
);

Deno.test("a confirmation from the previous turn is accepted and the write runs", async () => {
  const write = fakeWriteTool(needsYes);
  const { store, confirmationId } = await ask(write, [later]);
  // The turn between is the previous turn of `later`, so move the asking turn next to it.

  const result = await executeTool(contextOn(write, store, later), "fake_write", {
    ...input,
    confirmation_id: confirmationId,
  });

  assertObjectMatch(result, { status: "ok" });
  assertEquals(write.runs.length, 1);
});

Deno.test(
  "the confirmation id is not part of the input the write sees or the hash is made from",
  async () => {
    const write = fakeWriteTool(needsYes);
    const { store, confirmationId } = await ask(write, [later]);

    await executeTool(contextOn(write, store, later), "fake_write", {
      note: "lunch",
      extra: null,
      confirmation_id: confirmationId,
    });

    assertEquals(write.runs, [{ note: "lunch" }]);
  },
);

Deno.test("a confirmation is spent once", async () => {
  const write = fakeWriteTool(needsYes);
  const { store, confirmationId } = await ask(write, [later]);
  const ctx = contextOn(write, store, later);
  const call = { ...input, confirmation_id: confirmationId };

  const first = await executeTool(ctx, "fake_write", call);
  const second = await executeTool(ctx, "fake_write", call);

  assertEquals(first.status, "ok");
  assertObjectMatch(second, { status: "error", code: "confirmation_invalid" });
  assertEquals(write.runs.length, 1);
});

Deno.test(
  "two parallel calls with one confirmation run the write once and leave one slot",
  async () => {
    const write = fakeWriteTool(needsYes);
    const { store, confirmationId } = await ask(write, [later]);
    const ctx = contextOn(write, store, later);
    const call = { ...input, confirmation_id: confirmationId };

    const results = await Promise.all([
      executeTool(ctx, "fake_write", call),
      executeTool(ctx, "fake_write", call),
    ]);

    assertEquals(results.filter((result) => result.status === "ok").length, 1);
    assertEquals(write.runs.length, 1);
    assertEquals(store.actions.length, 1);
  },
);

Deno.test("a confirmation from two turns back is refused", async () => {
  const write = fakeWriteTool(needsYes);
  const { store, confirmationId } = await ask(write, [middle, later]);

  const result = await executeTool(contextOn(write, store, later), "fake_write", {
    ...input,
    confirmation_id: confirmationId,
  });

  assertObjectMatch(result, { status: "error", code: "confirmation_invalid" });
  assertEquals(write.runs, []);
  assertEquals(store.actions.length, 0);
});

Deno.test("a confirmation from another conversation is refused", async () => {
  const write = fakeWriteTool(needsYes);
  const foreign = "00000000-0000-4000-8000-0000000000c9";
  const store = createFakeActionStore({
    turns: [...turnsOfConversation([earlier], {}, foreign), ...turnsOfConversation([later])],
  });
  const asked = await executeTool(contextOn(write, store, earlier, foreign), "fake_write", input);
  if (asked.status !== "needs_confirmation") {
    throw new Error("expected a confirmation request");
  }

  const result = await executeTool(contextOn(write, store, later), "fake_write", {
    ...input,
    confirmation_id: asked.confirmationId,
  });

  assertObjectMatch(result, { code: "confirmation_invalid" });
  assertEquals(write.runs, []);
});

Deno.test("a confirmation asked for another tool is refused", async () => {
  const asking = fakeWriteTool({ ...needsYes, name: "delete_entry" });
  const acting = fakeWriteTool({ ...needsYes, name: "archive_recipe" });
  const store = createFakeActionStore({ turns: turnsOfConversation([earlier, later]) });
  const asked = await executeTool(contextOn(asking, store, earlier), "delete_entry", input);
  if (asked.status !== "needs_confirmation") {
    throw new Error("expected a confirmation request");
  }

  const result = await executeTool(contextOn(acting, store, later), "archive_recipe", {
    ...input,
    confirmation_id: asked.confirmationId,
  });

  assertObjectMatch(result, { code: "confirmation_invalid" });
  assertEquals(acting.runs, []);
});

Deno.test("a confirmation asked for another input is refused", async () => {
  const write = fakeWriteTool(needsYes);
  const store = createFakeActionStore({ turns: turnsOfConversation([earlier, later]) });
  const asked = await executeTool(contextOn(write, store, earlier), "fake_write", input);
  if (asked.status !== "needs_confirmation") {
    throw new Error("expected a confirmation request");
  }

  const result = await executeTool(contextOn(write, store, later), "fake_write", {
    note: "dinner",
    confirmation_id: asked.confirmationId,
  });

  assertObjectMatch(result, { code: "confirmation_invalid" });
  assertEquals(write.runs, []);
});

Deno.test("an id nobody issued is refused", async () => {
  const write = fakeWriteTool(needsYes);
  const store = createFakeActionStore({ turns: turnsOfConversation([earlier, later]) });

  const result = await executeTool(contextOn(write, store, later), "fake_write", {
    ...input,
    confirmation_id: "made-up",
  });

  assertObjectMatch(result, { code: "confirmation_invalid" });
  assertEquals(write.runs, []);
});

Deno.test("an earlier turn does not see the confirmation a later turn asked", async () => {
  const write = fakeWriteTool(needsYes);
  const store = createFakeActionStore({ turns: turnsOfConversation([earlier, later]) });
  const asked = await executeTool(contextOn(write, store, later), "fake_write", input);
  if (asked.status !== "needs_confirmation") {
    throw new Error("expected a confirmation request");
  }

  const result = await executeTool(contextOn(write, store, earlier), "fake_write", {
    ...input,
    confirmation_id: asked.confirmationId,
  });

  assertObjectMatch(result, { code: "confirmation_invalid" });
  assertEquals(write.runs, []);
});

Deno.test("a confirmation asked in this very turn cannot be spent in it", async () => {
  const write = fakeWriteTool(needsYes);
  const store = createFakeActionStore({ turns: turnsOfConversation([earlier]) });
  const ctx = contextOn(write, store, earlier);
  const asked = await executeTool(ctx, "fake_write", input);
  if (asked.status !== "needs_confirmation") {
    throw new Error("expected a confirmation request");
  }

  const result = await executeTool(ctx, "fake_write", {
    ...input,
    confirmation_id: asked.confirmationId,
  });

  assertObjectMatch(result, { code: "confirmation_invalid" });
  assertEquals(write.runs, []);
});

Deno.test(
  "a refused confirmation takes no slot, and a spent one that loses the race gives its slot back",
  async () => {
    const write = fakeWriteTool(needsYes);
    const { store, confirmationId } = await ask(write, [later]);
    store.spendPendingConfirmation = () => Promise.resolve(false);

    const result = await executeTool(contextOn(write, store, later), "fake_write", {
      ...input,
      confirmation_id: confirmationId,
    });

    assertObjectMatch(result, { code: "confirmation_invalid" });
    assertEquals(write.runs, []);
    assertEquals(store.actions.length, 0);
  },
);

Deno.test("a refusal for the write limit leaves the confirmation valid", async () => {
  const write = fakeWriteTool(needsYes);
  const { store, confirmationId } = await ask(write, [later]);
  const ctx = contextOn(write, store, later);
  for (let slot = 1; slot <= 10; slot += 1) {
    await store.insertReservation({
      userId,
      conversationId,
      turnId: later,
      turnSeq: slot,
      tool: "fake_write",
      targetTable: "log_entries",
    });
  }

  const result = await executeTool(ctx, "fake_write", {
    ...input,
    confirmation_id: confirmationId,
  });

  assertObjectMatch(result, { code: "write_limit_reached" });
  assertEquals(store.turns.find((turn) => turn.id === earlier)?.pending?.id, confirmationId);
  assertEquals(write.runs, []);
});

Deno.test("a write whose call does not need a confirmation ignores a confirmation id", async () => {
  const write = fakeWriteTool({ needsConfirmation: (value) => value.note === "everything" });
  const { ctx } = createFakeContext([write.definition]);

  const result = await executeTool(ctx, "fake_write", {
    note: "lunch",
    confirmation_id: "whatever",
  });

  assertEquals(result.status, "ok");
});

Deno.test("a confirmation request does not cost a slot or the ten", async () => {
  const write = fakeWriteTool(needsYes);
  const { ctx, store } = createFakeContext([write.definition]);

  for (let call = 0; call < 12; call += 1) {
    assertEquals((await executeTool(ctx, "fake_write", input)).status, "needs_confirmation");
  }

  assertEquals(store.actions.length, 0);
});

Deno.test(
  "a result that carries the user id and profile fields reaches the model without them",
  async () => {
    const read = fakeReadTool("get_day", {
      data: {
        user_id: userId,
        kcal: 1800,
        meals: [{ owner_id: userId, name: "Porridge", grams: 40 }],
        profile: {
          sex: "male",
          age: 35,
          birth_date: "1990-01-01",
          height_cm: 180,
          email: "a@b.test",
          note: "kept",
        },
      },
    });
    const { ctx } = createFakeContext([read.definition]);
    const spy = spyOnConsole();

    let result: ExecutionResult;
    try {
      result = await executeTool(ctx, "get_day", input);
    } finally {
      spy.restore();
    }

    assertEquals(payloadOf(result), {
      kcal: 1800,
      meals: [{ name: "Porridge", grams: 40 }],
      profile: { note: "kept" },
    });
    assertFalse(result.text.includes(userId));
    assertEquals(spy.lines, ["assistant get_day denied_key_removed"]);
  },
);

Deno.test("an invalid input does not echo the value back or log it", async () => {
  const spy = spyOnConsole();
  const read = fakeReadTool("get_day");
  const { ctx } = createFakeContext([read.definition]);

  let result: ExecutionResult;
  try {
    result = await executeTool(ctx, "get_day", { note: 82.4 });
  } finally {
    spy.restore();
  }

  assertFalse(result.text.includes("82.4"));
  assertEquals(spy.lines, []);
});

Deno.test("the user id never reaches the model, whichever key or string it is in", async () => {
  const spy = spyOnConsole();
  const read = fakeReadTool("get_day", {
    data: { note: `owned by ${userId}`, "birth-date": "1990-01-01", kcal: 1800 },
  });
  const { ctx } = createFakeContext([read.definition]);

  let result: ExecutionResult;
  try {
    result = await executeTool(ctx, "get_day", input);
  } finally {
    spy.restore();
  }

  assertEquals(payloadOf(result), { note: "owned by [removed]", kcal: 1800 });
  assertEquals(spy.lines, [
    "assistant get_day denied_key_removed",
    "assistant get_day user_id_value_removed",
  ]);
});

Deno.test(
  "a write that landed answers ok with a minimal text when its result cannot be written out",
  async () => {
    const circular: { [key: string]: JsonValue } = {};
    circular["self"] = circular;
    const write = fakeWriteTool();
    write.definition.run = () => Promise.resolve({ data: circular, target: { targetId: "row-1" } });
    const { ctx, store, reported } = createFakeContext([write.definition]);

    const result = await executeTool(ctx, "fake_write", input);

    assertObjectMatch(result, { status: "ok", actionId: "action-1" });
    assertEquals(payloadOf(result), { status: "done" });
    assertEquals(store.actions.length, 1);
    assertEquals(store.actions[0]?.targetId, "row-1");
    assertEquals(
      reported.map(({ functionName, code }) => [functionName, code]),
      [["assistant tool fake_write", "internal_error"]],
    );
  },
);

Deno.test(
  "a write that changed nothing also survives a result that cannot be written out",
  async () => {
    const circular: { [key: string]: JsonValue } = {};
    circular["self"] = circular;
    const write = fakeWriteTool();
    write.definition.run = () => Promise.resolve({ data: circular, target: null });
    const { ctx } = createFakeContext([write.definition]);

    const result = await executeTool(ctx, "fake_write", input);

    assertObjectMatch(result, { status: "ok", actionId: null });
  },
);

Deno.test("the write path scrubs the user id from what the model reads", async () => {
  const spy = spyOnConsole();
  const write = fakeWriteTool();
  write.definition.run = () =>
    Promise.resolve({ data: { note: `saved for ${userId}` }, target: { targetId: "row-1" } });
  const { ctx } = createFakeContext([write.definition]);

  let result: ExecutionResult;
  try {
    result = await executeTool(ctx, "fake_write", input);
  } finally {
    spy.restore();
  }

  assertObjectMatch(result, { status: "ok" });
  assertEquals(payloadOf(result), { note: "saved for [removed]" });
  assertFalse(result.text.includes(userId));
});
