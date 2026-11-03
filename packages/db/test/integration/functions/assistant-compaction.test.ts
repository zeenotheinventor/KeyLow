import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTurnStore } from "../../../supabase/functions/assistant/turnStore";
import { adminClient } from "../support/stack";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

import type { TurnStore } from "../../../supabase/functions/assistant/turnStore";
import type { TestUser } from "../support/users";

/*
 * Conversation compaction's store against the real tables (KEY-706), with two users of this file's own.
 * HTTP-free: nothing here calls a served function, so it runs in the `db` job and on any local stack. It
 * proves what the Deno tests with a fake client cannot: that the `updated_at` PostgREST hands back is a
 * value the compare-and-set accepts, that a turn started since makes it lose, and that the note lands on the
 * caller's conversation and never changes a message.
 *
 * The turn store takes the service client, which is the only role that may write these tables. The note in
 * these tests is synthetic text with no food in it.
 */

const note = "Synthetic note, one line.";

let alice: TestUser;
let bob: TestUser;
let store: TurnStore;

type Conversation = { conversationId: string; turnId: string };

// A conversation with one finished turn: the person's words and a reply.
async function finishedConversation(user: TestUser): Promise<Conversation> {
  const conversationId = await store.createConversation(user.id);
  const { turnId } = await store.startTurn({ userId: user.id, conversationId, text: "words" });
  await store.appendMessages(user.id, conversationId, turnId, [
    { role: "assistant", content: [{ type: "text", text: "reply" }] },
  ]);
  await store.finishTurn(user.id, turnId, "complete");
  return { conversationId, turnId };
}

async function conversationRow(conversationId: string) {
  const { data, error } = await adminClient()
    .from("assistant_conversations")
    .select("compaction_summary, compacted_through_turn_id, updated_at")
    .eq("id", conversationId)
    .single();
  if (error) {
    throw new Error("Could not read the conversation", { cause: error });
  }
  return data;
}

async function messagesOf(conversationId: string) {
  const { data, error } = await adminClient()
    .from("assistant_messages")
    .select("id, turn_id, role, content, seq")
    .eq("conversation_id", conversationId)
    .order("seq", { ascending: true });
  if (error) {
    throw new Error("Could not read the messages", { cause: error });
  }
  return data;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

beforeAll(async () => {
  store = createTurnStore(adminClient());
  [alice, bob] = await Promise.all([
    createTestUser("assistant-compaction"),
    createTestUser("assistant-compaction"),
  ]);
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe("storeCompaction", () => {
  it("accepts the updated_at it read back, stores the note and the turn, and moves updated_at on", async () => {
    const { conversationId, turnId } = await finishedConversation(alice);
    const state = await store.readCompactionState(alice.id, conversationId);
    await pause(5);

    const stored = await store.storeCompaction(alice.id, conversationId, {
      summary: note,
      throughTurnId: turnId,
      seenUpdatedAt: state.updatedAt,
    });

    expect(stored).toBe(true);
    const row = await conversationRow(conversationId);
    expect(row.compaction_summary).toBe(note);
    expect(row.compacted_through_turn_id).toBe(turnId);
    expect(new Date(row.updated_at).getTime()).toBeGreaterThan(new Date(state.updatedAt).getTime());
  });

  it("loses, and changes nothing, when a turn started after the read", async () => {
    const { conversationId, turnId } = await finishedConversation(alice);
    const state = await store.readCompactionState(alice.id, conversationId);
    await pause(5);
    const next = await store.startTurn({ userId: alice.id, conversationId, text: "more words" });
    await store.finishTurn(alice.id, next.turnId, "complete");

    const stored = await store.storeCompaction(alice.id, conversationId, {
      summary: note,
      throughTurnId: turnId,
      seenUpdatedAt: state.updatedAt,
    });

    expect(stored).toBe(false);
    const row = await conversationRow(conversationId);
    expect(row.compaction_summary).toBeNull();
    expect(row.compacted_through_turn_id).toBeNull();
  });

  it("loses when it is run a second time with the value the first run saw", async () => {
    const { conversationId, turnId } = await finishedConversation(alice);
    const { updatedAt } = await store.readCompactionState(alice.id, conversationId);
    await pause(5);
    const input = { summary: note, throughTurnId: turnId, seenUpdatedAt: updatedAt };

    const first = await store.storeCompaction(alice.id, conversationId, input);
    const second = await store.storeCompaction(alice.id, conversationId, {
      ...input,
      summary: "A second note.",
    });

    expect([first, second]).toEqual([true, false]);
    expect((await conversationRow(conversationId)).compaction_summary).toBe(note);
  });

  it("writes the caller's conversation only and leaves every message as it was", async () => {
    const own = await finishedConversation(alice);
    const others = await finishedConversation(bob);
    const messagesBefore = await messagesOf(own.conversationId);
    const bobMessagesBefore = await messagesOf(others.conversationId);
    const state = await store.readCompactionState(alice.id, own.conversationId);
    await pause(5);

    await store.storeCompaction(alice.id, own.conversationId, {
      summary: note,
      throughTurnId: own.turnId,
      seenUpdatedAt: state.updatedAt,
    });

    expect(await messagesOf(own.conversationId)).toEqual(messagesBefore);
    expect(await messagesOf(others.conversationId)).toEqual(bobMessagesBefore);
    expect((await conversationRow(others.conversationId)).compaction_summary).toBeNull();
  });

  it("does not write a conversation that belongs to someone else", async () => {
    const others = await finishedConversation(bob);
    const state = await store.readCompactionState(bob.id, others.conversationId);
    await pause(5);

    const stored = await store.storeCompaction(alice.id, others.conversationId, {
      summary: note,
      throughTurnId: others.turnId,
      seenUpdatedAt: state.updatedAt,
    });

    expect(stored).toBe(false);
    expect((await conversationRow(others.conversationId)).compaction_summary).toBeNull();
  });
});

describe("reading what compaction needs", () => {
  it("answers the note to the replay once it is stored, and none before", async () => {
    const { conversationId, turnId } = await finishedConversation(alice);
    const nilMessage = "00000000-0000-0000-0000-000000000000";
    const before = await store.readConversation(alice.id, conversationId, {
      excludeMessageId: nilMessage,
    });
    const state = await store.readCompactionState(alice.id, conversationId);
    await pause(5);
    await store.storeCompaction(alice.id, conversationId, {
      summary: note,
      throughTurnId: turnId,
      seenUpdatedAt: state.updatedAt,
    });

    const after = await store.readConversation(alice.id, conversationId, {
      excludeMessageId: nilMessage,
    });

    expect(before.compaction).toBeNull();
    expect(after.compaction).toEqual({ summary: note, throughTurnId: turnId });
    expect(after.messages).toEqual(before.messages);
  });

  it("says a turn is open while one runs and not once it has finished", async () => {
    const conversationId = await store.createConversation(alice.id);
    const started = await store.startTurn({ userId: alice.id, conversationId, text: "words" });
    const running = await store.readCompactionState(alice.id, conversationId);
    await store.finishTurn(alice.id, started.turnId, "complete");
    const finished = await store.readCompactionState(alice.id, conversationId);

    expect([running.turnIsOpen, finished.turnIsOpen]).toEqual([true, false]);
  });

  it("refuses to read the state of a conversation that is not the caller's", async () => {
    const others = await finishedConversation(bob);

    await expect(store.readCompactionState(alice.id, others.conversationId)).rejects.toThrow();
  });
});
