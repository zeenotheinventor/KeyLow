import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient } from "../support/stack";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

import type { TestUser } from "../support/users";

/*
 * The compare-and-set that stores a conversation's compaction note, against the real tables (KEY-706), with
 * two users of this file's own. HTTP-free: nothing here calls a served function, so it runs in the `db` job
 * and on any local stack. It proves what the Deno tests with a fake client cannot: that the `updated_at`
 * PostgREST hands back is a value the compare-and-set accepts, that a turn started since makes it lose, and
 * that the note lands on the caller's conversation and never changes a message.
 *
 * This file imports nothing from `supabase/functions/`, because that code needs the Deno core bundle and the
 * generated `database.types.ts`, which the static job does not have. `storeCompaction` and `readState`
 * below mirror the queries of `createTurnStore` in `functions/assistant/turnStore.ts`. The Deno tests prove
 * that function, and this file proves the query it sends. The note in these tests is synthetic text with no
 * food in it.
 */

const note = "Synthetic note, one line.";

let alice: TestUser;
let bob: TestUser;

type Conversation = { conversationId: string; turnId: string };

const admin = adminClient();

function must<Value>(
  result: { data: Value; error: { code: string } | null },
  action: string,
): NonNullable<Value> {
  if (result.error !== null) {
    throw new Error(`Could not ${action} (${result.error.code})`);
  }
  if (result.data === null || result.data === undefined) {
    throw new Error(`Could not ${action} (no row)`);
  }
  return result.data;
}

const touch = (conversationId: string) =>
  admin
    .from("assistant_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

// A conversation with turns started and finished the way the store does it: a turn row, the person's
// message, and a new `updated_at` on the conversation, at the start and again at the end.
async function startTurn(user: TestUser, conversationId: string, seq: number) {
  const userMessageId = crypto.randomUUID();
  const turn = must(
    await admin
      .from("assistant_turns")
      .insert({ conversation_id: conversationId, user_id: user.id, user_message_id: userMessageId })
      .select("id")
      .single(),
    "insert a turn",
  );
  must(
    await admin
      .from("assistant_messages")
      .insert({
        id: userMessageId,
        conversation_id: conversationId,
        turn_id: turn.id,
        user_id: user.id,
        role: "user",
        content: [{ type: "text", text: "words" }],
        seq,
      })
      .select("id")
      .single(),
    "insert a message",
  );
  await touch(conversationId);
  return turn.id;
}

async function finishTurn(user: TestUser, conversationId: string, turnId: string) {
  await admin
    .from("assistant_turns")
    .update({ status: "complete", finished_at: new Date().toISOString() })
    .eq("id", turnId)
    .eq("user_id", user.id);
  await touch(conversationId);
}

async function newConversation(user: TestUser): Promise<string> {
  return must(
    await admin.from("assistant_conversations").insert({ user_id: user.id }).select("id").single(),
    "create a conversation",
  ).id;
}

// A conversation with one finished turn: the person's words and a reply.
async function finishedConversation(user: TestUser): Promise<Conversation> {
  const conversationId = await newConversation(user);
  const turnId = await startTurn(user, conversationId, 1);
  must(
    await admin
      .from("assistant_messages")
      .insert({
        conversation_id: conversationId,
        turn_id: turnId,
        user_id: user.id,
        role: "assistant",
        content: [{ type: "text", text: "reply" }],
        seq: 2,
      })
      .select("id")
      .single(),
    "insert a reply",
  );
  await finishTurn(user, conversationId, turnId);
  return { conversationId, turnId };
}

// What `readCompactionState` reads: the conversation row and whether a turn is open.
async function readState(user: TestUser, conversationId: string) {
  const row = must(
    await admin
      .from("assistant_conversations")
      .select("compaction_summary, compacted_through_turn_id, updated_at")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle(),
    "read the conversation",
  );
  const { data, error } = await admin
    .from("assistant_turns")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .eq("status", "open")
    .limit(1);
  if (error) {
    throw new Error(`Could not read open turns (${error.code})`);
  }
  return { row, updatedAt: row.updated_at, turnIsOpen: data.length > 0 };
}

// What `storeCompaction` sends: the update is filtered by the conversation, the user and the `updated_at`
// compaction saw, and the answer is whether a row matched.
async function storeCompaction(
  userId: string,
  conversationId: string,
  input: { summary: string; throughTurnId: string; seenUpdatedAt: string },
): Promise<boolean> {
  const { data, error } = await admin
    .from("assistant_conversations")
    .update({
      compaction_summary: input.summary,
      compacted_through_turn_id: input.throughTurnId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("user_id", userId)
    .eq("updated_at", input.seenUpdatedAt)
    .select("id");
  if (error) {
    throw new Error(`Could not store the compaction (${error.code})`);
  }
  return data.length > 0;
}

async function conversationRow(conversationId: string) {
  return must(
    await admin
      .from("assistant_conversations")
      .select("compaction_summary, compacted_through_turn_id, updated_at")
      .eq("id", conversationId)
      .single(),
    "read the conversation",
  );
}

async function messagesOf(conversationId: string) {
  return must(
    await admin
      .from("assistant_messages")
      .select("id, turn_id, role, content, seq")
      .eq("conversation_id", conversationId)
      .order("seq", { ascending: true }),
    "read the messages",
  );
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

beforeAll(async () => {
  [alice, bob] = await Promise.all([
    createTestUser("assistant-compaction"),
    createTestUser("assistant-compaction"),
  ]);
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe("the compare-and-set that stores a note", () => {
  it("accepts the updated_at it read back, stores the note and the turn, and moves updated_at on", async () => {
    const { conversationId, turnId } = await finishedConversation(alice);
    const state = await readState(alice, conversationId);
    await pause(5);

    const stored = await storeCompaction(alice.id, conversationId, {
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
    const state = await readState(alice, conversationId);
    await pause(5);
    const nextTurnId = await startTurn(alice, conversationId, 3);
    await finishTurn(alice, conversationId, nextTurnId);

    const stored = await storeCompaction(alice.id, conversationId, {
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
    const { updatedAt } = await readState(alice, conversationId);
    await pause(5);
    const input = { summary: note, throughTurnId: turnId, seenUpdatedAt: updatedAt };

    const first = await storeCompaction(alice.id, conversationId, input);
    const second = await storeCompaction(alice.id, conversationId, {
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
    const state = await readState(alice, own.conversationId);
    await pause(5);

    await storeCompaction(alice.id, own.conversationId, {
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
    const state = await readState(bob, others.conversationId);
    await pause(5);

    const stored = await storeCompaction(alice.id, others.conversationId, {
      summary: note,
      throughTurnId: others.turnId,
      seenUpdatedAt: state.updatedAt,
    });

    expect(stored).toBe(false);
    expect((await conversationRow(others.conversationId)).compaction_summary).toBeNull();
  });

  it("refuses a note without its turn, because the table's check wants the two together", async () => {
    const { conversationId } = await finishedConversation(alice);
    const state = await readState(alice, conversationId);

    const { error } = await admin
      .from("assistant_conversations")
      .update({ compaction_summary: note })
      .eq("id", conversationId)
      .eq("updated_at", state.updatedAt);

    expect(error?.code).toBe("23514");
  });
});

describe("reading what compaction needs", () => {
  it("says a turn is open while one runs and not once it has finished", async () => {
    const conversationId = await newConversation(alice);
    const turnId = await startTurn(alice, conversationId, 1);
    const running = await readState(alice, conversationId);
    await finishTurn(alice, conversationId, turnId);
    const finished = await readState(alice, conversationId);

    expect([running.turnIsOpen, finished.turnIsOpen]).toEqual([true, false]);
  });

  it("does not show a conversation that is not the caller's", async () => {
    const others = await finishedConversation(bob);

    await expect(readState(alice, others.conversationId)).rejects.toThrow();
  });
});
