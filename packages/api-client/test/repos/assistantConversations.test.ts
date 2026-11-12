import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  assistantTargetSources,
  getAssistantConversationPage,
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
  longConversation,
  turnId,
  turnTime,
} from "../support/assistantFake";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";

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

// The default sources read the diary, which these tests do not serve, so they read with none.
const noSources: ReadonlyMap<string, AssistantTargetSource> = new Map();

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
      new Map([["unmapped_table", source]]),
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

    const read = await readAssistantActions(createTestClient(), {}, noSources);

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

    await readAssistantActions(createTestClient(), {}, noSources);

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

    const failure = await readAssistantActions(createTestClient(), {}, noSources).then(
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

    expect(await getAssistantConversationPage(createTestClient(), null)).toEqual({
      conversationId: null,
      messages: [],
      actions: [],
      olderCursor: null,
    });
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

    const read = await readAssistantActions(createTestClient(), {}, noSources);

    expect(read.actions).toHaveLength(2300);
    expect(new Set(read.actions.map((action) => action.id)).size).toBe(2300);
  });
});

const TURN_COUNT = 45;

describe("getAssistantConversationPage", () => {
  it("should read the newest conversation's newest 21 turns, newest first, with their messages embedded", async () => {
    const state = createAssistantFakeState(longConversation(TURN_COUNT));
    installAssistantFake(server, state);

    await getAssistantConversationPage(createTestClient(), null);

    const [read] = state.turnReads;
    expect(state.turnReads).toHaveLength(1);
    expect(read?.get("conversation_id")).toBe(`eq.${CONVERSATION_ID}`);
    expect(read?.get("order")).toBe("created_at.desc,id.desc");
    expect(read?.get("limit")).toBe("21");
    expect(read?.get("or")).toBeNull();
    expect(read?.get("select")).toContain(
      "assistant_messages(id,turn_id,role,content,display,seq)",
    );
    expect(read?.get("assistant_messages.order")).toBe("seq.asc");
  });

  it("should give the newest 20 turns' messages in seq order, each with its turn's status", async () => {
    installAssistantFake(server, createAssistantFakeState(longConversation(TURN_COUNT)));

    const page = await getAssistantConversationPage(createTestClient(), null);

    expect(page.messages).toHaveLength(40);
    expect(page.messages.at(0)).toMatchObject({ id: uuid("00000004", 50), turnStatus: "complete" });
    expect(page.messages.at(-1)).toMatchObject({ id: uuid("00000004", 89), turnStatus: "stopped" });
    expect(page.messages.map((message) => message.id)).toEqual(
      [...page.messages.map((message) => message.id)].sort(),
    );
  });

  it("should give a cursor naming the oldest turn of the page when an older turn exists", async () => {
    installAssistantFake(server, createAssistantFakeState(longConversation(TURN_COUNT)));

    const page = await getAssistantConversationPage(createTestClient(), null);

    expect(page.conversationId).toBe(CONVERSATION_ID);
    expect(page.olderCursor).toEqual({
      conversationId: CONVERSATION_ID,
      createdAt: turnTime(25),
      turnId: turnId(25),
    });
  });

  it("should give no cursor for exactly 20 turns", async () => {
    installAssistantFake(server, createAssistantFakeState(longConversation(20)));

    const page = await getAssistantConversationPage(createTestClient(), null);

    expect(page.messages).toHaveLength(40);
    expect(page.olderCursor).toBeNull();
  });

  it("should read the 20 turns older than the cursor with a keyset filter that quotes the timestamp", async () => {
    const state = createAssistantFakeState(longConversation(TURN_COUNT));
    installAssistantFake(server, state);
    const first = await getAssistantConversationPage(createTestClient(), null);
    state.turnReads.length = 0;
    state.conversationRead = null;

    const second = await getAssistantConversationPage(createTestClient(), first.olderCursor);

    expect(state.turnReads[0]?.get("or")).toBe(
      `(created_at.lt."${turnTime(25)}",and(created_at.eq."${turnTime(25)}",id.lt.${turnId(25)}))`,
    );
    expect(state.conversationRead).toBeNull();
    expect(second.messages.map((message) => message.id).at(0)).toBe(uuid("00000004", 10));
    expect(second.messages.map((message) => message.id).at(-1)).toBe(uuid("00000004", 49));
    expect(second.olderCursor).toMatchObject({ turnId: turnId(5) });
  });

  it("should end with the last 5 turns and no cursor, with no turn split or repeated across pages", async () => {
    installAssistantFake(server, createAssistantFakeState(longConversation(TURN_COUNT)));
    const first = await getAssistantConversationPage(createTestClient(), null);
    const second = await getAssistantConversationPage(createTestClient(), first.olderCursor);

    const third = await getAssistantConversationPage(createTestClient(), second.olderCursor);

    expect(third.messages).toHaveLength(10);
    expect(third.olderCursor).toBeNull();
    const ids = [first, second, third].flatMap((page) => page.messages.map((row) => row.id));
    expect(new Set(ids).size).toBe(90);
  });

  it("should read the actions of the page's turns only", async () => {
    const state = createAssistantFakeState(longConversation(TURN_COUNT));
    installAssistantFake(server, state);

    const page = await getAssistantConversationPage(createTestClient(), null);

    expect(state.actionReads).toHaveLength(1);
    const inList = state.actionReads[0]?.get("turn_id") ?? "";
    expect(inList.replace(/^in\.\(|\)$/g, "").split(",")).toHaveLength(20);
    expect(page.actions.map((action) => action.turnId).sort()).toEqual(
      [turnId(25), turnId(30), turnId(35), turnId(40)].sort(),
    );
  });

  it("should read no actions for a conversation with no turns", async () => {
    const state = createAssistantFakeState({ turns: [], messages: [] });
    installAssistantFake(server, state);

    const page = await getAssistantConversationPage(createTestClient(), null);

    expect(page).toEqual({
      conversationId: CONVERSATION_ID,
      messages: [],
      actions: [],
      olderCursor: null,
    });
    expect(state.actionReads).toEqual([]);
  });

  it("should read what the app draws for a message with the message", async () => {
    installAssistantFake(server, createAssistantFakeState());

    const page = await getAssistantConversationPage(createTestClient(), null);

    expect(page.messages.map((message) => message.display !== null)).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
  });

  it("should name the action and the database code in a failure and never the database's message", async () => {
    server.use(
      http.get(`${REST_URL}/assistant_conversations`, ({ request }) =>
        postgrestRows(request, [{ id: CONVERSATION_ID }]),
      ),
      http.get(`${REST_URL}/assistant_turns`, () =>
        postgrestError(500, "XX000", "failing row (2 eggs and toast) violates a check"),
      ),
    );

    const failure = await getAssistantConversationPage(createTestClient(), null).then(
      () => null,
      (thrown: unknown) => thrown,
    );

    expect(failure).toMatchObject({
      message: "Could not load your conversation (XX000)",
      cause: { code: "XX000" },
    });
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
      new Map([["unmapped_table", source]]),
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

      const read = await readAssistantActions(createTestClient(), {}, noSources);

      expect(read.actions[0]?.hasTarget).toBe(hasTarget);
    },
  );

  it("should carry the slot of each action in its turn", async () => {
    installAssistantFake(server, createAssistantFakeState());

    const read = await readAssistantActions(createTestClient(), {}, noSources);

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

    const read = await readAssistantActions(createTestClient(), {}, noSources);

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

    const read = await readAssistantActions(createTestClient(), {}, noSources);

    expect(asked).toEqual(["0", "1000"]);
    expect(read.actions).toHaveLength(1500);
  });
});

describe("the food_log_entries target source", () => {
  const source = assistantTargetSources.get("food_log_entries");

  const installReads = (entries: unknown[], timezone: string | null = "Europe/London") => {
    const asked: URL[] = [];
    server.use(
      http.get(`${REST_URL}/food_log_entries`, ({ request }) => {
        asked.push(new URL(request.url));
        return postgrestRows(request, entries);
      }),
      http.get(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [{ timezone }])),
    );
    return asked;
  };

  it("should read the entries by id, deleted or not, and answer each one's updated_at and its clock time", async () => {
    const asked = installReads([
      {
        id: ENTRY_ID,
        logged_at: "2026-07-03T07:10:00+00:00",
        updated_at: "2026-07-03T07:11:00.123456+00:00",
        item_type: "quick",
      },
    ]);

    const reads = await source?.(createTestClient(), [ENTRY_ID, MISSING_ENTRY_ID]);

    expect(asked[0]?.searchParams.get("id")).toBe(`in.(${ENTRY_ID},${MISSING_ENTRY_ID})`);
    expect(asked[0]?.searchParams.get("select")).toContain("updated_at");
    expect(asked[0]?.searchParams.get("deleted_at")).toBeNull();
    expect(reads).toHaveLength(1);
    expect(reads?.[0]).toMatchObject({
      id: ENTRY_ID,
      updatedAt: "2026-07-03T07:11:00.123456+00:00",
      row: { id: ENTRY_ID, clock_time: "08:10" },
    });
  });

  it("should read the clock in UTC for a profile with no time zone", async () => {
    installReads(
      [
        {
          id: ENTRY_ID,
          logged_at: "2026-07-03T07:10:00+00:00",
          updated_at: "2026-07-03T07:11:00+00:00",
        },
      ],
      null,
    );

    const reads = await source?.(createTestClient(), [ENTRY_ID]);

    expect(reads?.[0]?.row).toMatchObject({ clock_time: "07:10" });
  });
});

describe("the recipes target source", () => {
  const source = assistantTargetSources.get("recipes");
  const RECIPE_ID = "00000000-0000-4000-8000-0000000000e1";
  const MISSING_RECIPE_ID = "00000000-0000-4000-8000-0000000000e2";

  it("should read the recipes by id, archived or not, with the name and servings the words need and no change time", async () => {
    const asked: URL[] = [];
    server.use(
      http.get(`${REST_URL}/recipes`, ({ request }) => {
        asked.push(new URL(request.url));
        return postgrestRows(request, [
          { id: RECIPE_ID, name: "Pasta bake", servings: 4, is_archived: true },
        ]);
      }),
    );

    const reads = await source?.(createTestClient(), [RECIPE_ID, MISSING_RECIPE_ID]);

    expect(asked[0]?.searchParams.get("id")).toBe(`in.(${RECIPE_ID},${MISSING_RECIPE_ID})`);
    expect(asked[0]?.searchParams.get("is_archived")).toBeNull();
    expect(reads).toEqual([
      {
        id: RECIPE_ID,
        updatedAt: null,
        row: { id: RECIPE_ID, name: "Pasta bake", servings: 4, is_archived: true },
      },
    ]);
  });

  it("should name the action and the database code in a failure and never the database's message", async () => {
    server.use(
      http.get(`${REST_URL}/recipes`, () =>
        postgrestError(500, "XX000", "failing row (Pasta bake) violates a check"),
      ),
    );

    const failure = await source?.(createTestClient(), [RECIPE_ID]).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(failure).toMatchObject({
      message: "Could not load what the assistant changed (XX000)",
      cause: { code: "XX000" },
    });
  });
});

describe("the foods target source", () => {
  const source = assistantTargetSources.get("foods");
  const FOOD_ID = "00000000-0000-4000-8000-0000000000f1";
  const DELETED_FOOD_ID = "00000000-0000-4000-8000-0000000000f2";

  it("should read the foods that are not deleted, with the name the words need and no change time", async () => {
    const asked: URL[] = [];
    server.use(
      http.get(`${REST_URL}/foods`, ({ request }) => {
        asked.push(new URL(request.url));
        return postgrestRows(request, [{ id: FOOD_ID, name: "My protein bar" }]);
      }),
    );

    const reads = await source?.(createTestClient(), [FOOD_ID, DELETED_FOOD_ID]);

    expect(asked[0]?.searchParams.get("id")).toBe(`in.(${FOOD_ID},${DELETED_FOOD_ID})`);
    expect(asked[0]?.searchParams.get("deleted_at")).toBe("is.null");
    expect(reads).toEqual([
      { id: FOOD_ID, updatedAt: null, row: { id: FOOD_ID, name: "My protein bar" } },
    ]);
  });

  it("should name the action and the database code in a failure and never the database's message", async () => {
    server.use(
      http.get(`${REST_URL}/foods`, () =>
        postgrestError(500, "XX000", "failing row (My protein bar) violates a check"),
      ),
    );

    const failure = await source?.(createTestClient(), [FOOD_ID]).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(failure).toMatchObject({
      message: "Could not load what the assistant changed (XX000)",
      cause: { code: "XX000" },
    });
  });
});

describe("the programs target source", () => {
  const source = assistantTargetSources.get("programs");
  const PROGRAM_ID = "00000000-0000-4000-8000-0000000000a1";

  it("should read the programs by id with their change time and nothing about the plan", async () => {
    const asked: URL[] = [];
    server.use(
      http.get(`${REST_URL}/programs`, ({ request }) => {
        asked.push(new URL(request.url));
        return postgrestRows(request, [
          { id: PROGRAM_ID, updated_at: "2026-11-03T10:00:00+00:00" },
        ]);
      }),
    );

    const reads = await source?.(createTestClient(), [PROGRAM_ID]);

    expect(asked[0]?.searchParams.get("select")).toBe("id,updated_at");
    expect(reads).toEqual([
      { id: PROGRAM_ID, updatedAt: "2026-11-03T10:00:00+00:00", row: { id: PROGRAM_ID } },
    ]);
  });
});

describe("the training cards of the changes list", () => {
  const TRAINING_TURN_ID = "00000000-0000-4000-8000-0000000000c1";
  const FOOD_TURN_ID = "00000000-0000-4000-8000-0000000000c2";
  const PREVIOUS_VALUE_MARKER = "a-routine-name-that-must-not-leave-the-read";

  const storedCard = {
    actionIds: [FIRST_ACTION_ID],
    kind: "routine_updated",
    title: "Updated routine Push Pull Legs",
    sub: null,
    rows: [],
    changeDetail: "4 changes",
    totalText: null,
    note: null,
    link: null,
    undo: "available",
    undoneSub: null,
  };
  const messageOf = (turnId: string, display: unknown, id = `m-${turnId}`) => ({
    id,
    turn_id: turnId,
    role: "user",
    content: [],
    display,
    conversation_id: CONVERSATION_ID,
    seq: 1,
  });
  const trainingDisplay = {
    "call-1": {
      card: storedCard,
      undo: { previous: { name: PREVIOUS_VALUE_MARKER }, fingerprint: "f" },
    },
  };
  const trainingAction = actionRow({
    id: FIRST_ACTION_ID,
    turn_id: TRAINING_TURN_ID,
    tool: "edit_routine",
  });
  const foodAction = actionRow({ id: SECOND_ACTION_ID, turn_id: FOOD_TURN_ID, tool: "log_entry" });

  const read = (state: ReturnType<typeof createAssistantFakeState>) => {
    installAssistantFake(server, state);
    return readAssistantActions(createTestClient(), { withCards: true }, noSources);
  };

  it("should read the words of the card of a training write and nothing else the display holds", async () => {
    const { cards } = await read(
      createAssistantFakeState({
        actions: [trainingAction],
        messages: [messageOf(TRAINING_TURN_ID, trainingDisplay)],
      }),
    );

    expect(cards).toEqual([
      {
        actionIds: [FIRST_ACTION_ID],
        kind: "routine_updated",
        title: "Updated routine Push Pull Legs",
        sub: null,
        link: null,
        changeDetail: "4 changes",
      },
    ]);
    expect(JSON.stringify(cards)).not.toContain(PREVIOUS_VALUE_MARKER);
  });

  it("should make one select for the turns of the training writes, naming only the columns it needs", async () => {
    const state = createAssistantFakeState({
      actions: [trainingAction, foodAction],
      messages: [messageOf(TRAINING_TURN_ID, trainingDisplay)],
    });

    await read(state);

    expect(state.turnMessageReads).toHaveLength(1);
    expect(state.turnMessageReads[0]?.get("select")).toBe("id,display");
    expect(state.turnMessageReads[0]?.get("turn_id")).toBe(`in.(${TRAINING_TURN_ID})`);
  });

  it("should read no messages when no write is a training one", async () => {
    const state = createAssistantFakeState({ actions: [foodAction] });

    const { cards } = await read(state);

    expect(state.turnMessageReads).toEqual([]);
    expect(cards).toEqual([]);
  });

  it("should read no messages for a write whose conversation was deleted, which has no turn", async () => {
    const state = createAssistantFakeState({
      actions: [{ ...trainingAction, turn_id: null, conversation_id: null }],
    });

    const { cards } = await read(state);

    expect(state.turnMessageReads).toEqual([]);
    expect(cards).toEqual([]);
  });

  it("should give no card for a turn whose messages are gone, so its row falls back", async () => {
    const { cards } = await read(
      createAssistantFakeState({ actions: [trainingAction], messages: [] }),
    );

    expect(cards).toEqual([]);
  });

  it("should read no messages at all for the conversation's own read, which draws the cards itself", async () => {
    const state = createAssistantFakeState({ actions: [trainingAction] });
    installAssistantFake(server, state);

    await readAssistantActions(createTestClient(), {}, noSources);

    expect(state.turnMessageReads).toEqual([]);
  });

  it("should ask for at most 100 turns at a time, which keeps the request's address short", async () => {
    const turnId = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    const actions = Array.from({ length: 250 }, (_, index) =>
      actionRow({
        id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        turn_id: turnId(index),
        tool: "update_training_goals",
      }),
    );
    const state = createAssistantFakeState({ actions, messages: [] });

    await read(state);

    expect(
      state.turnMessageReads
        .map((query) => query.get("turn_id")?.split(",").length ?? 0)
        .sort((a, b) => a - b),
    ).toEqual([50, 100, 100]);
  });

  it("should name the action and the database code in a failure and never the database's message", async () => {
    installAssistantFake(server, createAssistantFakeState({ actions: [trainingAction] }));
    server.use(
      http.get(`${REST_URL}/assistant_messages`, () =>
        postgrestError(500, "XX000", `failing row (${PREVIOUS_VALUE_MARKER}) violates a check`),
      ),
    );

    const failure = await readAssistantActions(
      createTestClient(),
      { withCards: true },
      noSources,
    ).then(
      () => null,
      (thrown: unknown) => thrown,
    );

    expect(failure).toMatchObject({
      message: "Could not load what the assistant changed (XX000)",
      cause: { code: "XX000" },
    });
    expect(JSON.stringify(failure)).not.toContain(PREVIOUS_VALUE_MARKER);
  });
});
