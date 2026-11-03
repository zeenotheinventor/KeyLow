import { assistantChangesFromActions, threadFromMessages } from "@keylow/core";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { adminClient } from "./support/stack";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { requireServedFunction } from "../../../db/test/integration/support/functionsLane";
import {
  createAssistantConversation,
  deleteAllAssistantConversations,
  getLatestAssistantConversation,
  readAssistantActions,
  undoAssistantActions,
} from "../../src/repos/assistantConversations";
import { logQuickEntry, softDeleteLogEntry } from "../../src/repos/diaryWrites";

import type { TestUser } from "./support/users";
import type { AssistantTargetSource } from "../../src/repos/assistantConversations";
import type { Json } from "@keylow/db";

/*
 * The assistant's conversation, changes list, New conversation, Delete all conversations and Undo against
 * the real tables, with two users. The rows are inserted with the service role, as the function does,
 * and read back with each user's own JWT. The tests that call the `assistant` function need it served
 * (the `db` job serves every function), and those that do not run on any local stack.
 *
 * No write tool exists yet, so a real action cannot be undone here. The Undo that restores a deleted
 * entry belongs to the tool that records it (KEY-688), which adds that case beside the ones below.
 */

const messageText = (text: string): Json => [{ type: "text", text }];
const wrapped = (source: string, outcome: Json): string =>
  `<untrusted_data source="${source}">${JSON.stringify(outcome)}</untrusted_data>`;

type Conversation = { id: string; turnIds: string[] };

/** A conversation of `user`: one turn per question, stored as the function stores it. */
async function storeConversation(
  user: TestUser,
  turns: { text: string; reply: string; card?: Json; status?: "complete" | "stopped" }[],
  updatedAt: string,
): Promise<Conversation> {
  const admin = adminClient();
  const conversation = await admin
    .from("assistant_conversations")
    .insert({ user_id: user.id, updated_at: updatedAt })
    .select("id")
    .single();
  expect(conversation.error).toBeNull();
  const conversationId = conversation.data?.id ?? "";
  const turnIds: string[] = [];
  let seq = 0;
  for (const turn of turns) {
    const stored = await admin
      .from("assistant_turns")
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        user_message_id: crypto.randomUUID(),
        status: turn.status ?? "complete",
      })
      .select("id")
      .single();
    expect(stored.error).toBeNull();
    const turnId = stored.data?.id ?? "";
    turnIds.push(turnId);
    const messages: { role: "user" | "assistant"; content: Json; display?: Json }[] = [
      { role: "user", content: messageText(turn.text) },
      ...(turn.card === undefined
        ? []
        : [
            {
              role: "assistant" as const,
              content: [{ type: "tool_use", id: "call-1", name: "log_entry", input: {} }],
            },
            {
              role: "user" as const,
              content: [
                {
                  type: "tool_result",
                  tool_use_id: "call-1",
                  content: wrapped("log_entry", { status: "done" }),
                },
              ],
              display: { "call-1": { card: turn.card } },
            },
          ]),
      { role: "assistant", content: messageText(turn.reply) },
    ];
    const inserted = await admin.from("assistant_messages").insert(
      messages.map((message) => ({
        conversation_id: conversationId,
        turn_id: turnId,
        user_id: user.id,
        role: message.role,
        content: message.content,
        display: message.display ?? null,
        seq: (seq += 1),
      })),
    );
    expect(inserted.error).toBeNull();
  }
  return { id: conversationId, turnIds };
}

type ActionInput = {
  id?: string;
  targetUpdatedAt?: string;
  user: TestUser;
  conversation?: Conversation;
  turnIndex?: number;
  turnSeq: number;
  tool: string;
  targetTable?: string;
  targetId?: string;
  createdAt: string;
  undoneAt?: string;
};

async function storeAction(input: ActionInput): Promise<string> {
  const { data, error } = await adminClient()
    .from("assistant_actions")
    .insert({
      id: input.id ?? crypto.randomUUID(),
      user_id: input.user.id,
      conversation_id: input.conversation?.id ?? null,
      turn_id: input.conversation?.turnIds[input.turnIndex ?? 0] ?? null,
      turn_seq: input.turnSeq,
      tool: input.tool,
      target_table: input.targetTable ?? "recipes",
      target_id: input.targetId ?? crypto.randomUUID(),
      target_updated_at: input.targetUpdatedAt ?? null,
      created_at: input.createdAt,
      undone_at: input.undoneAt ?? null,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data?.id ?? "";
}

const loggedCard = (actionIds: string[]): Json => ({
  actionIds,
  kind: "logged",
  title: "Logged 2 eggs and toast at 08:10",
  sub: null,
  rows: [],
  totalText: null,
  note: null,
  link: null,
  undo: "available",
  undoneSub: null,
});

// The change time the assistant recorded when it logged the entry, which the entry keeps until it is deleted.
const entryStampWhenLogged = "2026-10-26T07:30:00Z";

/** Reads the diary entry's `deleted_at` as the change time, which is what an edit in the diary moves. */
const entryChangeTime: AssistantTargetSource = async (client, ids) => {
  const { data, error } = await client
    .from("food_log_entries")
    .select("id, deleted_at")
    .in("id", ids);
  expect(error).toBeNull();
  return (data ?? []).map((entry) => ({
    id: entry.id,
    updatedAt: entry.deleted_at ?? entryStampWhenLogged,
    row: { id: entry.id },
  }));
};

describe("the assistant conversation and its changes against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let conversationA: Conversation;
  let conversationB: Conversation;
  let actionIdsA: string[];
  let actionIdB: string;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key686"), createTestUser("key686")]);
    conversationA = await storeConversation(
      userA,
      [{ text: "A: 2 eggs and toast at 8:10", reply: "A: Logged." }],
      "2026-10-27T08:12:00Z",
    );
    actionIdsA = [
      await storeAction({
        user: userA,
        conversation: conversationA,
        turnSeq: 1,
        tool: "log_entry",
        createdAt: "2026-10-27T08:11:00Z",
      }),
      await storeAction({
        user: userA,
        conversation: conversationA,
        turnSeq: 2,
        tool: "log_entry",
        createdAt: "2026-10-27T08:11:01Z",
      }),
    ];
    // B's conversation is the newer one overall, so a read that forgot the owner would return it.
    conversationB = await storeConversation(
      userB,
      [{ text: "B: my private question", reply: "B: my private answer" }],
      "2026-10-27T09:00:00Z",
    );
    actionIdB = await storeAction({
      user: userB,
      conversation: conversationB,
      turnSeq: 1,
      tool: "create_recipe",
      createdAt: "2026-10-27T08:30:00Z",
    });
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  describe("the thread", () => {
    it("should read the newest conversation of the caller and never a row of another user", async () => {
      const conversation = await getLatestAssistantConversation(userA.client);

      expect(conversation?.conversationId).toBe(conversationA.id);
      expect(JSON.stringify(conversation)).not.toContain("B: ");
      expect(conversation?.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
      expect(conversation?.actions.map((action) => action.id).sort()).toEqual(actionIdsA.sort());
    });

    it("should read the other user's own conversation for them", async () => {
      const conversation = await getLatestAssistantConversation(userB.client);

      expect(conversation?.conversationId).toBe(conversationB.id);
      expect(JSON.stringify(conversation)).not.toContain("A: ");
    });

    it("should read a stopped turn's status next to its messages", async () => {
      const user = await createTestUser("key686");
      await storeConversation(
        user,
        [{ text: "How much protein?", reply: "You averaged 126 g of", status: "stopped" }],
        "2026-10-27T10:00:00Z",
      );

      const conversation = await getLatestAssistantConversation(user.client);

      expect(conversation?.messages.map((message) => message.turnStatus)).toEqual([
        "stopped",
        "stopped",
      ]);
    });

    it("should give a card its live undo state from the caller's actions", async () => {
      const user = await createTestUser("key686");
      const actionIds = [crypto.randomUUID(), crypto.randomUUID()];
      const conversation = await storeConversation(
        user,
        [{ text: "2 eggs and toast at 8:10", reply: "Logged.", card: loggedCard(actionIds) }],
        "2026-10-27T10:00:00Z",
      );
      for (const [index, id] of actionIds.entries()) {
        await storeAction({
          id,
          user,
          conversation,
          turnSeq: index + 1,
          tool: "log_entry",
          createdAt: "2026-10-27T10:00:00Z",
        });
      }
      const cardStates = async () => {
        const read = await getLatestAssistantConversation(user.client);
        return threadFromMessages(read?.messages ?? [], read?.actions ?? []).flatMap((item) =>
          item.kind === "card" ? [item.card.undo] : [],
        );
      };

      expect(await cardStates()).toEqual(["available"]);

      const { error } = await adminClient()
        .from("assistant_actions")
        .update({ undone_at: "2026-10-27T10:05:00Z" })
        .in("id", actionIds);
      expect(error).toBeNull();

      expect(await cardStates()).toEqual(["undone"]);
    });
  });

  describe("what the assistant changed", () => {
    it("should list only the caller's actions", async () => {
      const read = await readAssistantActions(userA.client);

      expect(read.actions.map((action) => action.id)).not.toContain(actionIdB);
      expect(read.actions.map((action) => action.id).sort()).toEqual(actionIdsA.sort());
    });

    it("should give Today 3 and Yesterday 2 with the right states for the board's five changes", async () => {
      const user = await createTestUser("key686");
      const day = (iso: string) => ({ user, createdAt: iso });
      const entry = await logQuickEntry(user.client, {
        kcal: 160,
        label: "Flat white",
        localDate: "2026-10-26",
        loggedAt: "2026-10-26T07:30:00Z",
      });
      await storeAction({ ...day("2026-10-27T08:11:00Z"), turnSeq: 1, tool: "log_entry" });
      await storeAction({ ...day("2026-10-27T08:11:01Z"), turnSeq: 2, tool: "log_entry" });
      await storeAction({ ...day("2026-10-27T09:42:00Z"), turnSeq: 1, tool: "create_recipe" });
      await storeAction({
        ...day("2026-10-27T12:30:00Z"),
        turnSeq: 1,
        tool: "copy_day",
        undoneAt: "2026-10-27T12:35:00Z",
      });
      await storeAction({ ...day("2026-10-26T19:05:00Z"), turnSeq: 1, tool: "archive_recipe" });
      await storeAction({
        ...day("2026-10-26T07:31:00Z"),
        turnSeq: 1,
        tool: "log_entry",
        targetTable: "food_log_entries",
        targetId: entry.id,
        targetUpdatedAt: entryStampWhenLogged,
      });
      // The person deletes the entry in the diary after the assistant logged it.
      await softDeleteLogEntry(user.client, entry.id);

      const read = await readAssistantActions(
        user.client,
        {},
        new Map([["food_log_entries", entryChangeTime]]),
      );
      const changes = assistantChangesFromActions(read.actions, {
        now: new Date("2026-10-27T14:00:00Z"),
        timeZone: "UTC",
        targets: read.targets,
      });

      expect(changes.days.map((changeDay) => [changeDay.label, changeDay.rows.length])).toEqual([
        ["Today", 3],
        ["Yesterday", 2],
      ]);
      expect(changes.days.flatMap((changeDay) => changeDay.rows.map((row) => row.state))).toEqual([
        "undone",
        "undo",
        "undo",
        "undo",
        "cant_undo",
      ]);
      expect(changes.days[1]?.rows[1]?.sub).toBe("07:31 · changed in your diary since");
      expect(changes.count).toBe(5);
    });
  });

  describe("through the assistant function", () => {
    beforeAll(async () => {
      await requireServedFunction(inject("stack"), "assistant");
    });

    it("should start a new conversation that becomes the caller's newest, with no thread", async () => {
      const conversationId = await createAssistantConversation(userA.client);

      const conversation = await getLatestAssistantConversation(userA.client);

      expect(conversation).toMatchObject({ conversationId, messages: [] });
      expect(conversationId).not.toBe(conversationA.id);
    });

    it("should leave the other user's newest conversation alone", async () => {
      expect((await getLatestAssistantConversation(userB.client))?.conversationId).toBe(
        conversationB.id,
      );
    });

    it("should answer undo_unavailable for an action the function cannot undo", async () => {
      const results = await undoAssistantActions(userA.client, actionIdsA.slice(0, 1));

      expect(results).toEqual([{ actionId: actionIdsA[0], result: "undo_unavailable" }]);
    });

    it("should answer not_found for another user's action and never undo it", async () => {
      const results = await undoAssistantActions(userA.client, [actionIdB]);

      expect(results).toEqual([{ actionId: actionIdB, result: "not_found" }]);
    });

    it("should answer already_undone for an action that is undone", async () => {
      const actionId = await storeAction({
        user: userA,
        turnSeq: 1,
        tool: "log_entry",
        createdAt: "2026-10-27T11:00:00Z",
        undoneAt: "2026-10-27T11:05:00Z",
      });

      const results = await undoAssistantActions(userA.client, [actionId]);

      expect(results).toEqual([{ actionId, result: "already_undone" }]);
    });
  });

  describe("delete all conversations", () => {
    it("should remove the caller's conversations, turns and messages and leave their actions", async () => {
      await deleteAllAssistantConversations(userA.client);

      const admin = adminClient();
      const conversations = await admin
        .from("assistant_conversations")
        .select("id")
        .eq("user_id", userA.id);
      const turns = await admin.from("assistant_turns").select("id").eq("user_id", userA.id);
      const messages = await admin.from("assistant_messages").select("id").eq("user_id", userA.id);
      const actions = await admin
        .from("assistant_actions")
        .select("id, conversation_id, turn_id")
        .eq("user_id", userA.id)
        .in("id", actionIdsA);
      expect([conversations.data, turns.data, messages.data]).toEqual([[], [], []]);
      expect(actions.data).toHaveLength(2);
      expect(actions.data?.every((action) => action.conversation_id === null)).toBe(true);
      expect(actions.data?.every((action) => action.turn_id === null)).toBe(true);
    });

    it("should leave the other user's conversation, messages and actions untouched", async () => {
      const admin = adminClient();
      const conversations = await admin
        .from("assistant_conversations")
        .select("id")
        .eq("user_id", userB.id);
      const messages = await admin.from("assistant_messages").select("id").eq("user_id", userB.id);
      const actions = await admin.from("assistant_actions").select("id").eq("id", actionIdB);

      expect(conversations.data).toHaveLength(1);
      expect(messages.data).toHaveLength(2);
      expect(actions.data).toHaveLength(1);
    });

    it("should leave the caller with no conversation to read", async () => {
      expect(await getLatestAssistantConversation(userA.client)).toBeNull();
    });
  });
});
