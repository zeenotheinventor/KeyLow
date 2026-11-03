import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  getLatestAssistantConversation,
  readAssistantActions,
} from "../../src/repos/assistantConversations";
import { createTestClient } from "../createTestClient";
import {
  CONVERSATION_ID,
  FIRST_ACTION_ID,
  SECOND_ACTION_ID,
  actionRow,
  createAssistantFakeState,
  installAssistantFake,
} from "../support/assistantFake";
import { REST_URL, postgrestError } from "../support/postgrest";

import type { AssistantTargetSource } from "../../src/repos/assistantConversations";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const ENTRY_ID = "00000000-0000-4000-8000-0000000000f1";
const OTHER_ENTRY_ID = "00000000-0000-4000-8000-0000000000f2";
const MISSING_ENTRY_ID = "00000000-0000-4000-8000-0000000000f3";

describe("readAssistantActions", () => {
  const installActions = () => {
    installAssistantFake(
      server,
      createAssistantFakeState({
        actions: [
          actionRow({ id: FIRST_ACTION_ID, target_id: ENTRY_ID, target_updated_at: "t0" }),
          actionRow({
            id: SECOND_ACTION_ID,
            target_id: null,
            target_ids: [OTHER_ENTRY_ID, MISSING_ENTRY_ID],
            target_updated_at: "t0",
          }),
          actionRow({ id: "x", tool: "update_targets", target_table: "targets", target_id: "t1" }),
        ],
      }),
    );
  };

  it("should read each source once with every id of its table and give the actions what they read back", async () => {
    installActions();
    const asked: string[][] = [];
    const source: AssistantTargetSource = (_client, ids) => {
      asked.push(ids);
      return Promise.resolve([
        { id: ENTRY_ID, updatedAt: "t0", row: { name: "Egg" } },
        { id: OTHER_ENTRY_ID, updatedAt: "t1", row: { name: "Toast" } },
      ]);
    };

    const read = await readAssistantActions(
      createTestClient(),
      {},
      new Map([["food_log_entries", source]]),
    );

    expect(asked).toEqual([[ENTRY_ID, OTHER_ENTRY_ID, MISSING_ENTRY_ID]]);
    expect(read.actions.map((action) => [action.id, action.targetIds, action.targets])).toEqual([
      [FIRST_ACTION_ID, [ENTRY_ID], [{ found: true, updatedAt: "t0" }]],
      [
        SECOND_ACTION_ID,
        [OTHER_ENTRY_ID, MISSING_ENTRY_ID],
        [
          { found: true, updatedAt: "t1" },
          { found: false, updatedAt: null },
        ],
      ],
      ["x", ["t1"], null],
    ]);
    expect(read.targets).toEqual([
      { id: ENTRY_ID, row: { name: "Egg" } },
      { id: OTHER_ENTRY_ID, row: { name: "Toast" } },
      { id: MISSING_ENTRY_ID, row: null },
      { id: "t1", row: null },
    ]);
  });

  it("should give the actions of a table with no source no change check", async () => {
    installActions();

    const read = await readAssistantActions(createTestClient());

    expect(read.actions.map((action) => action.targets)).toEqual([null, null, null]);
  });

  it("should read the newest action first, the later slot first among writes of one instant", async () => {
    let order: string | null = null;
    server.use(
      http.get(`${REST_URL}/assistant_actions`, ({ request }) => {
        order = new URL(request.url).searchParams.get("order");
        return Response.json([]);
      }),
    );

    await readAssistantActions(createTestClient());

    expect(order).toBe("created_at.desc,turn_seq.desc,id.desc");
  });
});

describe("the reads of the assistant", () => {
  it("should name the action and the database code in a failure and never the database's message", async () => {
    server.use(
      http.get(`${REST_URL}/assistant_actions`, () =>
        postgrestError(500, "XX000", "failing row (2 eggs and toast) violates a check"),
      ),
    );

    const failure = await readAssistantActions(createTestClient()).then(
      () => null,
      (thrown: unknown) => thrown,
    );

    expect(failure).toMatchObject({
      message: "Could not load what the assistant changed (XX000)",
      cause: { code: "XX000" },
    });
  });

  it("should give null for a person with no conversation", async () => {
    installAssistantFake(server, createAssistantFakeState({ conversationIds: [] }));

    expect(await getLatestAssistantConversation(createTestClient())).toBeNull();
  });
});

const uuid = (prefix: string, index: number) =>
  `${prefix}-0000-4000-8000-${String(index).padStart(12, "0")}`;

describe("the reads of a long history", () => {
  it("should read every action when there are more than the API returns to one request", async () => {
    const actions = Array.from({ length: 2300 }, (_, index) =>
      actionRow({
        id: uuid("00000001", index),
        turn_id: uuid("00000002", index),
        created_at: new Date(Date.UTC(2026, 9, 1) + index * 1000).toISOString(),
      }),
    );
    installAssistantFake(server, createAssistantFakeState({ actions }));

    const read = await readAssistantActions(createTestClient());

    expect(read.actions).toHaveLength(2300);
    expect(new Set(read.actions.map((action) => action.id)).size).toBe(2300);
  });

  it("should read every message and the status of every turn of a long conversation", async () => {
    const turns = Array.from({ length: 1100 }, (_, index) => ({
      id: uuid("00000003", index),
      status: index === 1099 ? "stopped" : "complete",
    }));
    const messages = turns.map((turn, index) => ({
      id: uuid("00000004", index),
      turn_id: turn.id,
      role: "user",
      content: [{ type: "text", text: `Question ${index}` }],
      display: null,
      conversation_id: CONVERSATION_ID,
      seq: index + 1,
    }));
    installAssistantFake(server, createAssistantFakeState({ messages, turns, actions: [] }));

    const conversation = await getLatestAssistantConversation(createTestClient());

    expect(conversation?.messages).toHaveLength(1100);
    expect(conversation?.messages.at(-1)).toMatchObject({ turnStatus: "stopped" });
    expect(conversation?.messages.at(0)).toMatchObject({ turnStatus: "complete" });
  });

  it("should read a message whose turn started after the turns were read as open", async () => {
    installAssistantFake(server, createAssistantFakeState({ turns: [] }));

    const conversation = await getLatestAssistantConversation(createTestClient());

    expect(conversation?.messages.map((message) => message.turnStatus)).toEqual([
      "open",
      "open",
      "open",
      "open",
      "open",
    ]);
  });

  it("should read what the app draws for a message with the message", async () => {
    installAssistantFake(server, createAssistantFakeState());

    const conversation = await getLatestAssistantConversation(createTestClient());

    expect(conversation?.messages.map((message) => message.display !== null)).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
  });
});

describe("the target rows of an action", () => {
  it("should ask a source for at most 100 ids at a time", async () => {
    const ids = Array.from({ length: 250 }, (_, index) => uuid("00000005", index));
    installAssistantFake(
      server,
      createAssistantFakeState({
        actions: [
          actionRow({ target_id: null, target_ids: ids.slice(0, 10) }),
          ...ids
            .slice(10)
            .map((id, index) =>
              actionRow({ id: uuid("00000006", index), target_id: id, turn_seq: index + 2 }),
            ),
        ],
      }),
    );
    const asked: number[] = [];
    const source: AssistantTargetSource = (_client, chunk) => {
      asked.push(chunk.length);
      return Promise.resolve(chunk.map((id) => ({ id, updatedAt: null, row: {} })));
    };

    const read = await readAssistantActions(
      createTestClient(),
      {},
      new Map([["food_log_entries", source]]),
    );

    expect(asked).toEqual([100, 100, 50]);
    expect(read.actions.every((action) => action.targets?.every((target) => target.found))).toBe(
      true,
    );
  });

  it.each([
    ["a single row", { target_id: ENTRY_ID }, true],
    ["several rows", { target_id: null, target_ids: [ENTRY_ID] }, true],
    ["a diary day", { target_id: null, target_local_date: "2026-10-27" }, true],
    ["nothing, a slot that never landed", { target_id: null }, false],
  ])(
    "should say whether an action that changed %s has a target",
    async (_name, fields, hasTarget) => {
      installAssistantFake(server, createAssistantFakeState({ actions: [actionRow(fields)] }));

      const read = await readAssistantActions(createTestClient());

      expect(read.actions[0]?.hasTarget).toBe(hasTarget);
    },
  );

  it("should carry the slot of each action in its turn", async () => {
    installAssistantFake(server, createAssistantFakeState());

    const read = await readAssistantActions(createTestClient());

    expect(read.actions.map((action) => action.turnSeq).sort()).toEqual([1, 2]);
  });
});

describe("the end of the paging", () => {
  const actionsOf = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      actionRow({
        id: uuid("00000007", index),
        created_at: new Date(Date.UTC(2026, 9, 1) + index * 1000).toISOString(),
      }),
    );

  it.each([999, 1000, 1001])("should read exactly %i actions", async (count) => {
    installAssistantFake(server, createAssistantFakeState({ actions: actionsOf(count) }));

    const read = await readAssistantActions(createTestClient());

    expect(read.actions).toHaveLength(count);
  });

  it("should keep a row once when a write moved it across the edge of two pages", async () => {
    const rows = actionsOf(1500);
    const asked: string[] = [];
    server.use(
      http.get(`${REST_URL}/assistant_actions`, ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get("offset"));
        asked.push(String(offset));
        // The second page starts one row early, as if a row had been inserted ahead of it.
        const page = offset === 0 ? rows.slice(0, 1000) : rows.slice(999);
        return HttpResponse.json(page);
      }),
    );

    const read = await readAssistantActions(createTestClient());

    expect(asked).toEqual(["0", "1000"]);
    expect(read.actions).toHaveLength(1500);
  });
});
