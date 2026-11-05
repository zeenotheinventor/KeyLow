import { assert, assertEquals, assertNotEquals } from "@std/assert";

import { confirmedCallOf } from "./confirmedCall.ts";

import type { PreviousTurn, StoredMessage } from "./turnStore.ts";

const pendingId = "11111111-1111-4111-8111-111111111111";
const entryIds = ["e1", "e2"];

const previousTurn: PreviousTurn = {
  status: "confirm",
  pendingTool: "delete_entry",
  pendingConfirmationId: pendingId,
  pendingConfirmLabel: "Delete 2 entries",
};

let nextMessage = 0;
const message = (
  role: StoredMessage["role"],
  content: unknown,
  display: unknown = null,
): StoredMessage => {
  nextMessage += 1;
  return {
    id: `message-${nextMessage}`,
    turnId: "turn-1",
    role,
    content,
    display: display as StoredMessage["display"],
  };
};

const askedHistory = (overrides: { name?: string; input?: unknown } = {}): StoredMessage[] => [
  message("user", [{ type: "text", text: "Delete both entries" }]),
  message("assistant", [
    { type: "text", text: "Looking." },
    {
      type: "tool_use",
      id: "toolu_read",
      name: "get_entries",
      input: { local_date: "2026-11-03" },
    },
    {
      type: "tool_use",
      id: "toolu_ask",
      name: overrides.name ?? "delete_entry",
      input: "input" in overrides ? overrides.input : { ids: entryIds },
    },
  ]),
  message(
    "user",
    [{ type: "tool_result", tool_use_id: "toolu_ask", content: "needs confirmation" }],
    { toolu_ask: { confirm: { confirmationId: pendingId, question: "Delete both?" } } },
  ),
];

Deno.test("confirmedCallOf finds the call by the pending id among several calls", () => {
  const block = confirmedCallOf(askedHistory(), previousTurn);

  assertEquals(block?.name, "delete_entry");
  assertEquals(block?.type, "tool_use");
  assertEquals(block?.input, { ids: entryIds, confirmation_id: pendingId });
});

Deno.test("confirmedCallOf gives the call a new tool_use id every time", () => {
  const history = askedHistory();

  const first = confirmedCallOf(history, previousTurn);
  const second = confirmedCallOf(history, previousTurn);

  assert(first !== null && second !== null);
  assertNotEquals(first.id, "toolu_ask");
  assertNotEquals(first.id, second.id);
  assert(/^toolu_[0-9a-f]{32}$/.test(first.id));
});

Deno.test("confirmedCallOf overwrites a confirmation_id the stored input already held", () => {
  const history = askedHistory({ input: { ids: entryIds, confirmation_id: "other" } });

  assertEquals(confirmedCallOf(history, previousTurn)?.input, {
    ids: entryIds,
    confirmation_id: pendingId,
  });
});

Deno.test("confirmedCallOf answers null when the previous turn has no pending id", () => {
  assertEquals(
    confirmedCallOf(askedHistory(), { ...previousTurn, pendingConfirmationId: null }),
    null,
  );
});

Deno.test("confirmedCallOf answers null when there is no previous turn", () => {
  assertEquals(confirmedCallOf(askedHistory(), null), null);
});

Deno.test("confirmedCallOf answers null when no row holds a confirmation with that id", () => {
  const history = askedHistory();
  assertEquals(
    confirmedCallOf(history, { ...previousTurn, pendingConfirmationId: "someone-else" }),
    null,
  );
  assertEquals(confirmedCallOf(history.slice(0, 2), previousTurn), null);
});

Deno.test("confirmedCallOf answers null when the block has another tool's name", () => {
  assertEquals(confirmedCallOf(askedHistory({ name: "archive_recipe" }), previousTurn), null);
});

Deno.test("confirmedCallOf answers null when the input is not an object", () => {
  assertEquals(confirmedCallOf(askedHistory({ input: [1, 2] }), previousTurn), null);
  assertEquals(confirmedCallOf(askedHistory({ input: "ids" }), previousTurn), null);
  assertEquals(confirmedCallOf(askedHistory({ input: null }), previousTurn), null);
});

Deno.test("confirmedCallOf answers null when the display key leads to no tool_use block", () => {
  const history = askedHistory();
  history[2] = message("user", history[2]?.content, {
    toolu_missing: { confirm: { confirmationId: pendingId, question: "?" } },
  });

  assertEquals(confirmedCallOf(history, previousTurn), null);
});

Deno.test("confirmedCallOf ignores an older confirmation with another id", () => {
  const older = [
    message("assistant", [
      { type: "tool_use", id: "toolu_old", name: "delete_entry", input: { ids: ["old"] } },
    ]),
    message("user", [{ type: "tool_result", tool_use_id: "toolu_old" }], {
      toolu_old: { confirm: { confirmationId: "older-id", question: "?" } },
    }),
  ];

  assertEquals(confirmedCallOf([...older, ...askedHistory()], previousTurn)?.input, {
    ids: entryIds,
    confirmation_id: pendingId,
  });
});
