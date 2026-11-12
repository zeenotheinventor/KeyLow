import { assertEquals, assertInstanceOf, assertRejects } from "@std/assert";

import { spyOnConsole } from "../_shared/assistant/testing.ts";
import { fakeSupabase, seqKeyViolation } from "./testing.ts";
import { ConversationBusyError, createTurnStore } from "./turnStore.ts";

import type { FakeOptions, Row } from "./testing.ts";
import type { TurnStore } from "./turnStore.ts";

const userId = "00000000-0000-4000-8000-0000000000a1";
const otherUserId = "00000000-0000-4000-8000-0000000000b2";
const conversationId = "00000000-0000-4000-8000-0000000000c1";
const otherConversationId = "00000000-0000-4000-8000-0000000000c2";
const turnId = "00000000-0000-4000-8000-0000000000d3";
const earlierTurnId = "00000000-0000-4000-8000-0000000000d2";
const messageId = "00000000-0000-4000-8000-0000000000f1";
const now = new Date("2026-11-03T12:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

function build(options: FakeOptions = {}) {
  const fake = fakeSupabase({ now, ...options });
  const store: TurnStore = createTurnStore(fake.client, { now: () => now });
  return { ...fake, store };
}

const seqOf = (rows: Row[] | undefined) => (rows ?? []).map((row) => row["seq"]);

const existingMessage = (seq: number, overrides: Row = {}): Row => ({
  id: crypto.randomUUID(),
  conversation_id: conversationId,
  turn_id: earlierTurnId,
  user_id: userId,
  role: "user",
  content: [{ type: "text", text: `message ${seq}` }],
  display: null,
  seq,
  ...overrides,
});

const turnRow = (overrides: Row = {}): Row => ({
  id: turnId,
  conversation_id: conversationId,
  user_id: userId,
  user_message_id: messageId,
  status: "open",
  pending_confirmation: null,
  created_at: minutesAgo(0),
  finished_at: null,
  ...overrides,
});

const conversationRow: Row = { id: conversationId, user_id: userId, updated_at: minutesAgo(30) };

const startInput = { userId, conversationId, text: "two eggs on toast" };

const foodName = "sourdough with halloumi";
const appended = [
  { role: "assistant" as const, content: [{ type: "text", text: "Logged." }], display: null },
  {
    role: "user" as const,
    content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "ok" }],
    display: { toolu_1: { citation: "Diary, 3 November" } },
  },
];

Deno.test(
  "appendMessages writes consecutive seq values after the last one, in one insert",
  async () => {
    const { store, operations, tables } = build({
      tables: { assistant_messages: [existingMessage(3), existingMessage(4)] },
    });

    await store.appendMessages(userId, conversationId, turnId, appended);

    const inserts = operations.filter((operation) => operation.kind === "insert");
    assertEquals(inserts.length, 1);
    assertEquals(
      inserts[0]?.values,
      appended.map((message, index) => ({
        conversation_id: conversationId,
        turn_id: turnId,
        user_id: userId,
        role: message.role,
        content: message.content,
        display: message.display,
        seq: 5 + index,
      })),
    );
    assertEquals(seqOf(tables["assistant_messages"]), [3, 4, 5, 6]);
  },
);

Deno.test("appendMessages starts at 1 in an empty conversation", async () => {
  const { store, tables } = build();

  await store.appendMessages(userId, conversationId, turnId, appended);

  assertEquals(seqOf(tables["assistant_messages"]), [1, 2]);
});

Deno.test("appendMessages reads the last seq of this conversation only, newest first", async () => {
  const { store, operations } = build();

  await store.appendMessages(userId, conversationId, turnId, appended);

  const read = operations.find((operation) => operation.kind === "select");
  assertEquals(read?.columns, "seq");
  assertEquals(read?.filters, { conversation_id: conversationId });
  assertEquals(read?.chain, ["select", "eq", "order", "limit"]);
});

Deno.test("appendMessages writes display as given and null when it is absent", async () => {
  const { store, tables } = build();

  await store.appendMessages(userId, conversationId, turnId, [
    { role: "assistant", content: [{ type: "text", text: "Hello" }] },
    { role: "user", content: [{ type: "text", text: "Hi" }], display: { a: { estimate: "~" } } },
  ]);

  assertEquals(
    (tables["assistant_messages"] ?? []).map((row) => row["display"]),
    [null, { a: { estimate: "~" } }],
  );
});

Deno.test("appendMessages with nothing to write asks the database nothing", async () => {
  const { store, operations } = build();

  await store.appendMessages(userId, conversationId, turnId, []);

  assertEquals(operations, []);
});

Deno.test("appendMessages retries once on a seq collision, with a fresh read", async () => {
  const { store, operations, tables } = build({
    tables: { assistant_messages: [existingMessage(1)] },
    competingMessage: existingMessage(2),
  });

  await store.appendMessages(userId, conversationId, turnId, appended);

  assertEquals(operations.filter((operation) => operation.kind === "insert").length, 2);
  assertEquals(operations.filter((operation) => operation.kind === "select").length, 2);
  assertEquals(seqOf(tables["assistant_messages"]), [1, 2, 3, 4]);
});

Deno.test("appendMessages throws on a second seq collision and writes nothing", async () => {
  const { store, operations, tables } = build({
    failures: [{ table: "assistant_messages", kind: "insert", error: seqKeyViolation, times: 2 }],
  });

  await assertRejects(
    () => store.appendMessages(userId, conversationId, turnId, appended),
    Error,
    "23505",
  );

  assertEquals(operations.filter((operation) => operation.kind === "insert").length, 2);
  assertEquals(tables["assistant_messages"] ?? [], []);
});

Deno.test("appendMessages does not retry any other failure", async () => {
  const otherKey = {
    code: "23505",
    message: 'duplicate key value violates unique constraint "assistant_messages_pkey"',
  };
  for (const error of [otherKey, { code: "XX000" }]) {
    const { store, operations } = build({
      failures: [{ table: "assistant_messages", kind: "insert", error }],
    });

    await assertRejects(() => store.appendMessages(userId, conversationId, turnId, appended));

    assertEquals(operations.filter((operation) => operation.kind === "insert").length, 1);
  }
});

Deno.test("appendMessages never logs or throws the message content", async () => {
  const content = [{ type: "text", text: `I had ${foodName}` }];
  const spy = spyOnConsole();
  let message = "";
  try {
    await build().store.appendMessages(userId, conversationId, turnId, [{ role: "user", content }]);
    const failing = build({
      failures: [{ table: "assistant_messages", kind: "insert", error: { code: "XX000" } }],
    });
    await failing.store
      .appendMessages(userId, conversationId, turnId, [{ role: "user", content }])
      .catch((caught: Error) => {
        message = caught.message;
      });
  } finally {
    spy.restore();
  }

  assertEquals(spy.lines, []);
  assertEquals(message.includes(foodName), false);
  assertEquals(message.length > 0, true);
});

Deno.test(
  "startTurn stores the turn, the message through the same writer, and bumps the conversation",
  async () => {
    const { store, operations, tables } = build({
      tables: {
        assistant_conversations: [conversationRow],
        assistant_messages: [existingMessage(7)],
      },
    });

    const started = await store.startTurn(startInput);

    const [turn] = tables["assistant_turns"] ?? [];
    assertEquals(started, { turnId: turn?.["id"], userMessageId: turn?.["user_message_id"] });
    const message = (tables["assistant_messages"] ?? []).find((row) => row["seq"] === 8);
    assertEquals(message?.["id"], started.userMessageId);
    assertEquals(message?.["turn_id"], started.turnId);
    assertEquals(message?.["role"], "user");
    assertEquals(message?.["content"], [{ type: "text", text: "two eggs on toast" }]);
    assertEquals(message?.["display"], null);
    const bump = operations.find(
      (operation) => operation.table === "assistant_conversations" && operation.kind === "update",
    );
    assertEquals(bump?.values, { updated_at: now.toISOString() });
    assertEquals(bump?.filters, { id: conversationId, user_id: userId });
  },
);

Deno.test("startTurn survives a seq collision on the user message", async () => {
  const { store, tables } = build({
    tables: {
      assistant_conversations: [conversationRow],
      assistant_messages: [existingMessage(1)],
    },
    competingMessage: existingMessage(2),
  });

  await store.startTurn(startInput);

  assertEquals(seqOf(tables["assistant_messages"]), [1, 2, 3]);
});

Deno.test("startTurn fails the turn it inserted when the message insert fails", async () => {
  const { store, operations, tables } = build({
    failures: [{ table: "assistant_messages", kind: "insert", error: { code: "XX000" } }],
  });

  await assertRejects(() => store.startTurn(startInput));

  const [turn] = tables["assistant_turns"] ?? [];
  assertEquals(turn?.["status"], "failed");
  assertEquals(typeof turn?.["finished_at"], "string");
  const mark = operations.find((operation) => "id" in operation.filters);
  assertEquals(mark?.filters, { id: turn?.["id"], user_id: userId });
});

Deno.test("startTurn fails the turn it inserted when the seq read fails", async () => {
  const { store, tables } = build({
    failures: [{ table: "assistant_messages", kind: "select", error: { code: "XX000" } }],
  });

  await assertRejects(() => store.startTurn(startInput));

  assertEquals(
    (tables["assistant_turns"] ?? []).map((turn) => turn["status"]),
    ["failed"],
  );
});

Deno.test("startTurn leaves no failed mark when the turn insert itself fails", async () => {
  const { store, operations } = build({
    failures: [{ table: "assistant_turns", kind: "insert", error: { code: "XX000" } }],
  });

  await assertRejects(() => store.startTurn(startInput));

  assertEquals(
    operations.filter((operation) => operation.kind === "update" && "id" in operation.filters),
    [],
  );
});

Deno.test("startTurn refuses a conversation with an open turn of 2 minutes", async () => {
  const { store, tables } = build({
    tables: { assistant_turns: [turnRow({ created_at: minutesAgo(2) })] },
  });

  const refused = await store.startTurn(startInput).catch((caught: unknown) => caught);

  assertInstanceOf(refused, ConversationBusyError);
  assertEquals((tables["assistant_turns"] ?? []).length, 1);
  assertEquals(tables["assistant_messages"] ?? [], []);
});

Deno.test("startTurn marks an open turn of 6 minutes failed and starts the new turn", async () => {
  const { store, tables } = build({
    tables: {
      assistant_conversations: [conversationRow],
      assistant_turns: [turnRow({ created_at: minutesAgo(6) })],
    },
  });

  const started = await store.startTurn(startInput);

  const turns = tables["assistant_turns"] ?? [];
  assertEquals(turns.find((turn) => turn["id"] === turnId)?.["status"], "failed");
  assertEquals(turns.find((turn) => turn["id"] === turnId)?.["finished_at"], now.toISOString());
  assertEquals(turns.find((turn) => turn["id"] === started.turnId)?.["status"], "open");
});

Deno.test(
  "startTurn marks stale turns of this user and conversation, older than 5 minutes",
  async () => {
    const { store, operations } = build({ tables: { assistant_conversations: [conversationRow] } });

    await store.startTurn(startInput);

    const stale = operations.find(
      (operation) => operation.table === "assistant_turns" && operation.kind === "update",
    );
    assertEquals(stale?.values, { status: "failed", finished_at: now.toISOString() });
    assertEquals(stale?.filters, {
      conversation_id: conversationId,
      user_id: userId,
      status: "open",
      "created_at<": minutesAgo(5),
    });
  },
);

Deno.test(
  "startTurn is not blocked by finished turns or by another conversation or user",
  async () => {
    const { store } = build({
      tables: {
        assistant_conversations: [conversationRow],
        assistant_turns: [
          turnRow({ id: earlierTurnId, status: "complete", created_at: minutesAgo(1) }),
          turnRow({ conversation_id: otherConversationId, created_at: minutesAgo(1) }),
          turnRow({ user_id: otherUserId, created_at: minutesAgo(1) }),
        ],
      },
    });

    await store.startTurn(startInput);
  },
);

Deno.test("startTurn throws without starting a turn when the stale mark fails", async () => {
  const { store, tables } = build({
    failures: [{ table: "assistant_turns", kind: "update", error: { code: "XX000" } }],
  });

  await assertRejects(() => store.startTurn(startInput), Error, "XX000");

  assertEquals(tables["assistant_turns"] ?? [], []);
  assertEquals(tables["assistant_messages"] ?? [], []);
});

Deno.test("startTurn throws without starting a turn when the open turn read fails", async () => {
  const { store, tables } = build({
    failures: [{ table: "assistant_turns", kind: "select", error: { code: "XX000" } }],
  });

  await assertRejects(() => store.startTurn(startInput), Error, "XX000");

  assertEquals(tables["assistant_turns"] ?? [], []);
  assertEquals(tables["assistant_messages"] ?? [], []);
});

const lowId = "00000000-0000-4000-8000-000000000001";
const highId = "ffffffff-ffff-4fff-bfff-ffffffffffff";

Deno.test("startTurn loses to an older open turn that appeared after the busy check", async () => {
  const older = turnRow({
    id: lowId,
    user_message_id: "00000000-0000-4000-8000-0000000000f9",
    created_at: new Date(now.getTime() - 1000).toISOString(),
  });
  const { store, tables, operations } = build({
    tables: { assistant_conversations: [conversationRow] },
    competingTurn: older,
  });

  const refused = await store.startTurn(startInput).catch((caught: unknown) => caught);

  assertInstanceOf(refused, ConversationBusyError);
  const turns = tables["assistant_turns"] ?? [];
  assertEquals(turns.find((turn) => turn["id"] === lowId)?.["status"], "open");
  const mine = turns.find((turn) => turn["id"] !== lowId);
  assertEquals([mine?.["status"], mine?.["finished_at"]], ["failed", now.toISOString()]);
  assertEquals(tables["assistant_messages"] ?? [], []);
  assertEquals(tables["assistant_conversations"]?.[0]?.["updated_at"], minutesAgo(30));
  const marks = operations.filter(
    (operation) => operation.kind === "update" && operation.filters["id"] === mine?.["id"],
  );
  assertEquals(marks.length, 1);
});

Deno.test("startTurn breaks a tie on created_at by id, so exactly one side loses", async () => {
  const sameInstant = (id: string) => turnRow({ id, created_at: now.toISOString() });
  const loses = build({ competingTurn: sameInstant(lowId) });
  const wins = build({
    tables: { assistant_conversations: [conversationRow] },
    competingTurn: sameInstant(highId),
  });

  const refused = await loses.store.startTurn(startInput).catch((caught: unknown) => caught);
  const started = await wins.store.startTurn(startInput);

  assertInstanceOf(refused, ConversationBusyError);
  const theirs = (wins.tables["assistant_turns"] ?? []).find((turn) => turn["id"] === highId);
  assertEquals(theirs?.["status"], "open");
  assertEquals((wins.tables["assistant_messages"] ?? []).length, 1);
  assertEquals(typeof started.turnId, "string");
});

Deno.test("startTurn fails its own turn when the second look at the open turns fails", async () => {
  const { store, tables } = build({
    failures: [{ table: "assistant_turns", kind: "select", error: { code: "XX000" }, skip: 1 }],
  });

  await assertRejects(() => store.startTurn(startInput), Error, "XX000");

  assertEquals(
    (tables["assistant_turns"] ?? []).map((turn) => turn["status"]),
    ["failed"],
  );
  assertEquals(tables["assistant_messages"] ?? [], []);
});

Deno.test("setUserMessageContent replaces the content of the user's own message", async () => {
  const { store, operations, tables } = build({
    tables: { assistant_messages: [existingMessage(1, { id: messageId })] },
  });
  const blocks = [
    { type: "text", text: "Context: today is Tuesday" },
    { type: "text", text: "two eggs on toast" },
  ];

  await store.setUserMessageContent(userId, messageId, blocks);

  assertEquals(tables["assistant_messages"]?.[0]?.["content"], blocks);
  const update = operations.find((operation) => operation.kind === "update");
  assertEquals(update?.values, { content: blocks });
  assertEquals(update?.filters, { id: messageId, user_id: userId });
});

Deno.test(
  "finishTurn sets the status while the turn is open, and bumps the conversation",
  async () => {
    const { store, operations, tables } = build({
      tables: { assistant_conversations: [conversationRow], assistant_turns: [turnRow()] },
    });

    await store.finishTurn(userId, turnId, "complete");

    const [turn] = tables["assistant_turns"] ?? [];
    assertEquals([turn?.["status"], turn?.["finished_at"]], ["complete", now.toISOString()]);
    const update = operations.find(
      (operation) => operation.table === "assistant_turns" && operation.kind === "update",
    );
    assertEquals(update?.filters, { id: turnId, user_id: userId, status: "open" });
    assertEquals(tables["assistant_conversations"]?.[0]?.["updated_at"], now.toISOString());
  },
);

Deno.test(
  "finishTurn never overwrites an earlier ending, and does not bump the conversation",
  async () => {
    const { store, tables } = build({
      tables: {
        assistant_conversations: [conversationRow],
        assistant_turns: [turnRow({ status: "stopped", finished_at: minutesAgo(1) })],
      },
    });

    await store.finishTurn(userId, turnId, "failed");

    assertEquals(tables["assistant_turns"]?.[0]?.["status"], "stopped");
    assertEquals(tables["assistant_turns"]?.[0]?.["finished_at"], minutesAgo(1));
    assertEquals(tables["assistant_conversations"]?.[0]?.["updated_at"], minutesAgo(30));
  },
);

Deno.test("finishTurn throws when the update fails", async () => {
  const { store } = build({
    tables: { assistant_turns: [turnRow()] },
    failures: [{ table: "assistant_turns", kind: "update", error: { code: "XX000" } }],
  });

  await assertRejects(() => store.finishTurn(userId, turnId, "failed"), Error, "XX000");
});

Deno.test("readConversation pages past 1,000 rows and keeps seq order", async () => {
  const rows = Array.from({ length: 1001 }, (_, index) => existingMessage(index + 1));
  const { store, operations } = build({ tables: { assistant_messages: rows.toReversed() } });

  const { messages } = await store.readConversation(userId, conversationId, {
    excludeMessageId: messageId,
  });

  assertEquals(messages.length, 1001);
  assertEquals(
    messages.map((message) => message.content),
    rows.map((row) => row["content"]),
  );
  assertEquals(
    operations.filter((operation) => operation.table === "assistant_messages").map((o) => o.range),
    [
      [0, 999],
      [1000, 1999],
    ],
  );
});

Deno.test(
  "readConversation leaves out the turn's own message and maps the stored fields",
  async () => {
    const kept = existingMessage(1, { display: { toolu_1: { card: { kind: "log" } } } });
    const { store, operations } = build({
      tables: {
        assistant_messages: [kept, existingMessage(2, { id: messageId })],
        assistant_turns: [turnRow()],
      },
    });

    const { messages } = await store.readConversation(userId, conversationId, {
      excludeMessageId: messageId,
    });

    assertEquals(messages, [
      {
        id: kept["id"],
        turnId: earlierTurnId,
        role: "user",
        content: kept["content"],
        display: kept["display"],
      },
    ]);
    const read = operations.find((operation) => operation.table === "assistant_messages");
    assertEquals(read?.filters, {
      conversation_id: conversationId,
      user_id: userId,
      "id!=": messageId,
    });
  },
);

Deno.test("readConversation answers the latest earlier turn and its pending tool", async () => {
  const pending = {
    id: "confirmation-1",
    tool: "delete_entry",
    input_hash: "abc",
    confirm_label: "Delete 3 entries",
  };
  const { store } = build({
    tables: {
      assistant_turns: [
        turnRow({ id: "00000000-0000-4000-8000-0000000000d1", created_at: minutesAgo(40) }),
        turnRow({
          id: earlierTurnId,
          user_message_id: "00000000-0000-4000-8000-0000000000f0",
          status: "confirm",
          pending_confirmation: pending,
          created_at: minutesAgo(20),
        }),
        turnRow({ created_at: minutesAgo(0) }),
      ],
    },
  });

  const { previousTurn } = await store.readConversation(userId, conversationId, {
    excludeMessageId: messageId,
  });

  assertEquals(previousTurn, {
    status: "confirm",
    pendingTool: "delete_entry",
    pendingConfirmationId: "confirmation-1",
    pendingConfirmLabel: "Delete 3 entries",
  });
});

Deno.test(
  "a pending confirmation stored before the button's words were kept has no label",
  async () => {
    const { store } = build({
      tables: {
        assistant_turns: [
          turnRow({
            id: earlierTurnId,
            user_message_id: "00000000-0000-4000-8000-0000000000f0",
            status: "confirm",
            pending_confirmation: { id: "confirmation-1", tool: "delete_entry", input_hash: "abc" },
            created_at: minutesAgo(20),
          }),
          turnRow({ created_at: minutesAgo(0) }),
        ],
      },
    });

    const { previousTurn } = await store.readConversation(userId, conversationId, {
      excludeMessageId: messageId,
    });

    assertEquals(previousTurn, {
      status: "confirm",
      pendingTool: "delete_entry",
      pendingConfirmationId: "confirmation-1",
      pendingConfirmLabel: null,
    });
  },
);

Deno.test("a pending confirmation with no id has no confirmation id", async () => {
  const { store } = build({
    tables: {
      assistant_turns: [
        turnRow({
          id: earlierTurnId,
          user_message_id: "00000000-0000-4000-8000-0000000000f0",
          status: "confirm",
          pending_confirmation: { tool: "delete_entry", confirm_label: "Delete 3 entries" },
          created_at: minutesAgo(20),
        }),
        turnRow({ created_at: minutesAgo(0) }),
      ],
    },
  });

  const { previousTurn } = await store.readConversation(userId, conversationId, {
    excludeMessageId: messageId,
  });

  assertEquals(previousTurn?.pendingConfirmationId, null);
});

Deno.test(
  "readConversation answers no previous turn for the first one, and no tool without a pending one",
  async () => {
    const first = build({ tables: { assistant_turns: [turnRow()] } });
    const second = build({
      tables: {
        assistant_turns: [
          turnRow({
            id: earlierTurnId,
            user_message_id: "00000000-0000-4000-8000-0000000000f0",
            status: "complete",
            created_at: minutesAgo(20),
          }),
          turnRow(),
        ],
      },
    });
    const options = { excludeMessageId: messageId };

    assertEquals(
      (await first.store.readConversation(userId, conversationId, options)).previousTurn,
      null,
    );
    assertEquals(
      (await second.store.readConversation(userId, conversationId, options)).previousTurn,
      {
        status: "complete",
        pendingTool: null,
        pendingConfirmationId: null,
        pendingConfirmLabel: null,
      },
    );
  },
);

Deno.test("readTimeZone selects the time zone and nothing else", async () => {
  const { store, operations } = build({
    tables: { profiles: [{ id: userId, timezone: "Europe/London", birth_date: "1990-01-01" }] },
  });

  assertEquals(await store.readTimeZone(userId), "Europe/London");

  const read = operations.find((operation) => operation.table === "profiles");
  assertEquals(read?.columns, "timezone");
  assertEquals(read?.filters, { id: userId });
});

Deno.test("readTimeZone throws when there is no profile", async () => {
  await assertRejects(() => build().store.readTimeZone(userId));
});

Deno.test(
  "turnHasAction answers true when the turn has an action row, false when not",
  async () => {
    const { store, operations } = build({
      tables: { assistant_actions: [{ id: "a1", turn_id: turnId, user_id: userId }] },
    });

    assertEquals(await store.turnHasAction(turnId), true);
    assertEquals(await store.turnHasAction(earlierTurnId), false);

    const read = operations[0];
    assertEquals(
      [read?.columns, read?.filters, read?.chain],
      ["id", { turn_id: turnId }, ["select", "eq", "limit"]],
    );
  },
);

Deno.test("turnHasAction throws rather than answer false when the read fails", async () => {
  const { store } = build({
    failures: [{ table: "assistant_actions", kind: "select", error: { code: "XX000" } }],
  });

  await assertRejects(() => store.turnHasAction(turnId), Error, "XX000");
});

// ---- Compaction (KEY-706) ----

const noteText = "Logged 2 large eggs (100 g) on 2026-11-02 at 08:00.";
const compactedRow = (overrides: Row = {}): Row => ({
  ...conversationRow,
  compaction_summary: noteText,
  compacted_through_turn_id: earlierTurnId,
  ...overrides,
});

Deno.test(
  "readConversation answers the conversation's note, and null when it has none",
  async () => {
    const withNote = build({ tables: { assistant_conversations: [compactedRow()] } });
    const without = build({ tables: { assistant_conversations: [conversationRow] } });
    const options = { excludeMessageId: messageId };

    assertEquals(
      (await withNote.store.readConversation(userId, conversationId, options)).compaction,
      {
        summary: noteText,
        throughTurnId: earlierTurnId,
      },
    );
    assertEquals(
      (await without.store.readConversation(userId, conversationId, options)).compaction,
      null,
    );
    const read = withNote.operations.find(
      (operation) => operation.table === "assistant_conversations",
    );
    assertEquals(read?.filters, { id: conversationId, user_id: userId });
  },
);

Deno.test(
  "readCompactionState answers the note, the updated_at it saw and whether a turn is open",
  async () => {
    const idle = build({
      tables: {
        assistant_conversations: [compactedRow()],
        assistant_turns: [turnRow({ status: "complete" })],
      },
    });
    const busy = build({
      tables: { assistant_conversations: [conversationRow], assistant_turns: [turnRow()] },
    });

    assertEquals(await idle.store.readCompactionState(userId, conversationId), {
      note: { summary: noteText, throughTurnId: earlierTurnId },
      updatedAt: minutesAgo(30),
      turnIsOpen: false,
    });
    assertEquals(await busy.store.readCompactionState(userId, conversationId), {
      note: null,
      updatedAt: minutesAgo(30),
      turnIsOpen: true,
    });
  },
);

Deno.test("readCompactionState throws for a conversation the user does not own", async () => {
  const { store } = build({ tables: { assistant_conversations: [conversationRow] } });

  await assertRejects(() => store.readCompactionState(otherUserId, conversationId));
});

const compactionInput = (seen: string, summary = noteText) => ({
  summary,
  throughTurnId: turnId,
  seenUpdatedAt: seen,
});

Deno.test(
  "storeCompaction sets the note and turn, writes a new updated_at, and answers true",
  async () => {
    const { store, tables, operations } = build({
      tables: {
        assistant_conversations: [conversationRow, { ...conversationRow, id: otherConversationId }],
      },
    });

    const stored = await store.storeCompaction(
      userId,
      conversationId,
      compactionInput(minutesAgo(30)),
    );

    assertEquals(stored, true);
    const [own, other] = tables["assistant_conversations"] ?? [];
    assertEquals(own?.["compaction_summary"], noteText);
    assertEquals(own?.["compacted_through_turn_id"], turnId);
    assertEquals(own?.["updated_at"], now.toISOString());
    assertEquals(other?.["compaction_summary"], undefined);
    const write = operations.find((operation) => operation.kind === "update");
    assertEquals(write?.filters, {
      id: conversationId,
      user_id: userId,
      updated_at: minutesAgo(30),
    });
  },
);

Deno.test(
  "storeCompaction leaves the conversation alone and answers false when a turn started since",
  async () => {
    const { store, tables } = build({ tables: { assistant_conversations: [conversationRow] } });

    const stored = await store.storeCompaction(
      userId,
      conversationId,
      compactionInput(minutesAgo(31)),
    );

    assertEquals(stored, false);
    assertEquals(tables["assistant_conversations"]?.[0], conversationRow);
  },
);

Deno.test("storeCompaction never touches the messages", async () => {
  const messages = [existingMessage(1), existingMessage(2)];
  const { store, tables, operations } = build({
    tables: { assistant_conversations: [conversationRow], assistant_messages: messages },
  });
  const before = JSON.stringify(tables["assistant_messages"]);

  await store.storeCompaction(userId, conversationId, compactionInput(minutesAgo(30)));

  assertEquals(JSON.stringify(tables["assistant_messages"]), before);
  assertEquals(
    operations.filter((operation) => operation.table === "assistant_messages"),
    [],
  );
});

Deno.test("storeCompaction throws the code of a failed write and never the note", async () => {
  const { store } = build({
    tables: { assistant_conversations: [conversationRow] },
    failures: [
      {
        table: "assistant_conversations",
        kind: "update",
        error: { code: "42501", message: noteText },
      },
    ],
  });

  const error = await store
    .storeCompaction(userId, conversationId, compactionInput(minutesAgo(30)))
    .then(
      () => null,
      (caught: unknown) => caught,
    );

  assertInstanceOf(error, Error);
  assertEquals(error.message.includes("42501"), true);
  assertEquals(error.message.includes("eggs"), false);
});
