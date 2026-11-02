import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createActionStore,
  maxWritesPerTurn,
  reserveNextSlot,
} from "../../../supabase/functions/_shared/assistant/store";
import { adminClient } from "../support/stack";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

import type { SlotRequest } from "../../../supabase/functions/_shared/assistant/store";
import type { TestUser } from "../support/users";

/*
 * The assistant's action store and its slot reservation against the real tables, with two users.
 * HTTP-free: nothing here calls a served function, so the file runs in the `db` job and on any
 * local stack. It proves what the executor relies on (ADR 0006, ADR 0003 Amendment 14): the unique
 * key and the check on `turn_seq`, the Postgres codes the store turns into outcomes, the release of a
 * slot, and that every query is filtered by the user it is run for.
 *
 * The store takes the service client, which is the only role that may write these tables.
 */

type Conversation = { user: TestUser; conversationId: string; turnId: string };

const store = createActionStore(adminClient());

async function newConversation(user: TestUser): Promise<Conversation> {
  const admin = adminClient();
  const { data: conversation, error: conversationError } = await admin
    .from("assistant_conversations")
    .insert({ user_id: user.id })
    .select("id")
    .single();
  if (conversationError) {
    throw new Error("Could not create a conversation", { cause: conversationError });
  }
  const turnId = await newTurn(user, conversation.id);
  return { user, conversationId: conversation.id, turnId };
}

async function newTurn(user: TestUser, conversationId: string): Promise<string> {
  const { data, error } = await adminClient()
    .from("assistant_turns")
    .insert({
      conversation_id: conversationId,
      user_id: user.id,
      user_message_id: crypto.randomUUID(),
    })
    .select("id")
    .single();
  if (error) {
    throw new Error("Could not create a turn", { cause: error });
  }
  return data.id;
}

const slotRequest = (conversation: Conversation): SlotRequest => ({
  userId: conversation.user.id,
  conversationId: conversation.conversationId,
  turnId: conversation.turnId,
  tool: "log_entry",
  targetTable: "log_entries",
});

async function countActions(turnId: string): Promise<number> {
  const { count, error } = await adminClient()
    .from("assistant_actions")
    .select("id", { count: "exact", head: true })
    .eq("turn_id", turnId);
  if (error) {
    throw new Error("Could not count the actions", { cause: error });
  }
  return count ?? 0;
}

let alice: Conversation;
let bob: Conversation;

beforeAll(async () => {
  alice = await newConversation(await createTestUser("key670-alice"));
  bob = await newConversation(await createTestUser("key670-bob"));
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe("the slots of a turn", () => {
  it("takes ten distinct slots for ten parallel reservations, and refuses the eleventh", async () => {
    const outcomes = await Promise.all(
      Array.from({ length: maxWritesPerTurn }, () => reserveNextSlot(store, slotRequest(alice))),
    );

    const slots = outcomes.map((o) => (o.outcome === "reserved" ? o.turnSeq : 0));
    expect(slots.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(await reserveNextSlot(store, slotRequest(alice))).toEqual({ outcome: "limit_reached" });
    expect(await countActions(alice.turnId)).toBe(10);
  });

  it("answers over_limit for an eleventh slot, which is the table's check refusing it", async () => {
    expect(await store.insertReservation({ ...slotRequest(alice), turnSeq: 11 })).toEqual({
      outcome: "over_limit",
    });
  });

  it("answers slot_taken for a slot that is already held, which is the unique key", async () => {
    expect(await store.insertReservation({ ...slotRequest(alice), turnSeq: 3 })).toEqual({
      outcome: "slot_taken",
    });
  });

  it("does not let the full turn of one user touch the turn of another", async () => {
    const outcome = await reserveNextSlot(store, slotRequest(bob));

    expect(outcome).toMatchObject({ outcome: "reserved", turnSeq: 1 });
  });

  it("runs twelve parallel reservations on a fresh turn to ten reserved and two refused", async () => {
    const fresh = {
      ...bob,
      turnId: await newTurn(bob.user, bob.conversationId),
    };

    const outcomes = await Promise.all(
      Array.from({ length: 12 }, () => reserveNextSlot(store, slotRequest(fresh))),
    );

    expect(outcomes.filter((o) => o.outcome === "reserved")).toHaveLength(10);
    expect(outcomes.filter((o) => o.outcome === "limit_reached")).toHaveLength(2);
    expect(await countActions(fresh.turnId)).toBe(10);
  });

  it("frees a slot when it is released, and only for the user it belongs to", async () => {
    const turn = { ...alice, turnId: await newTurn(alice.user, alice.conversationId) };
    const first = await reserveNextSlot(store, slotRequest(turn));
    if (first.outcome !== "reserved") {
      throw new Error("expected a slot");
    }

    await store.release(first.actionId, bob.user.id);
    expect(await countActions(turn.turnId)).toBe(1);

    await store.release(first.actionId, alice.user.id);
    expect(await countActions(turn.turnId)).toBe(0);
    expect(await reserveNextSlot(store, slotRequest(turn))).toMatchObject({ turnSeq: 1 });
  });
});

describe("the target of an action and its undo", () => {
  async function freshAction() {
    const turn = { ...alice, turnId: await newTurn(alice.user, alice.conversationId) };
    const slot = await reserveNextSlot(store, slotRequest(turn));
    if (slot.outcome !== "reserved") {
      throw new Error("expected a slot");
    }
    return slot.actionId;
  }

  it("stores the ids, the diary date and the change time of a write", async () => {
    const actionId = await freshAction();
    const rowId = crypto.randomUUID();
    const otherRowId = crypto.randomUUID();

    await store.fillTarget(actionId, alice.user.id, {
      targetIds: [rowId, otherRowId],
      targetLocalDate: "2026-11-02",
      targetUpdatedAt: "2026-11-02T10:00:00.000Z",
    });

    expect(await store.findAction(actionId, alice.user.id)).toMatchObject({
      id: actionId,
      userId: alice.user.id,
      tool: "log_entry",
      targetTable: "log_entries",
      targetId: null,
      targetIds: [rowId, otherRowId],
      targetLocalDate: "2026-11-02",
      undoneAt: null,
    });
  });

  it("finds an action for its owner only", async () => {
    const actionId = await freshAction();

    expect(await store.findAction(actionId, bob.user.id)).toBeNull();
  });

  it("lets one caller claim an undo, and gives the claim back on request", async () => {
    const actionId = await freshAction();

    const claims = await Promise.all([
      store.claimUndo(actionId, alice.user.id, new Date().toISOString()),
      store.claimUndo(actionId, alice.user.id, new Date().toISOString()),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);

    await store.releaseUndoClaim(actionId, alice.user.id);
    expect(await store.claimUndo(actionId, alice.user.id, new Date().toISOString())).toBe(true);
  });

  it("does not let another user claim an undo", async () => {
    const actionId = await freshAction();

    expect(await store.claimUndo(actionId, bob.user.id, new Date().toISOString())).toBe(false);
    expect((await store.findAction(actionId, alice.user.id))?.undoneAt).toBeNull();
  });
});

describe("the pending confirmation of a turn", () => {
  const confirmation = { id: crypto.randomUUID(), tool: "delete_entry", inputHash: "a".repeat(64) };

  it("is found from the next turn of the same conversation, and nowhere else", async () => {
    const conversation = await newConversation(alice.user);
    await store.storePendingConfirmation(conversation.turnId, alice.user.id, confirmation);
    const nextTurnId = await newTurn(alice.user, conversation.conversationId);
    const otherConversation = await newConversation(alice.user);

    expect(
      await store.previousPendingConfirmation(
        conversation.conversationId,
        alice.user.id,
        nextTurnId,
      ),
    ).toEqual({ turnId: conversation.turnId, confirmation });
    // The turn that asked has no previous turn, so it finds nothing of its own.
    expect(
      await store.previousPendingConfirmation(
        conversation.conversationId,
        alice.user.id,
        conversation.turnId,
      ),
    ).toBeNull();
    expect(
      await store.previousPendingConfirmation(
        otherConversation.conversationId,
        alice.user.id,
        otherConversation.turnId,
      ),
    ).toBeNull();
    // Another user cannot read it, even with the right ids.
    expect(
      await store.previousPendingConfirmation(conversation.conversationId, bob.user.id, nextTurnId),
    ).toBeNull();
  });

  it("is not found from two turns on", async () => {
    const conversation = await newConversation(alice.user);
    await store.storePendingConfirmation(conversation.turnId, alice.user.id, confirmation);
    await newTurn(alice.user, conversation.conversationId);
    const thirdTurnId = await newTurn(alice.user, conversation.conversationId);

    expect(
      await store.previousPendingConfirmation(
        conversation.conversationId,
        alice.user.id,
        thirdTurnId,
      ),
    ).toBeNull();
  });

  it("is not seen by an earlier turn, only by the turns after the one that asked", async () => {
    const conversation = await newConversation(alice.user);
    const askingTurnId = await newTurn(alice.user, conversation.conversationId);
    await store.storePendingConfirmation(askingTurnId, alice.user.id, confirmation);

    // The first turn is older than the one that asked, and is still open.
    expect(
      await store.previousPendingConfirmation(
        conversation.conversationId,
        alice.user.id,
        conversation.turnId,
      ),
    ).toBeNull();
    expect(
      await store.previousPendingConfirmation(
        conversation.conversationId,
        alice.user.id,
        await newTurn(alice.user, conversation.conversationId),
      ),
    ).toEqual({ turnId: askingTurnId, confirmation });
  });

  it("is spent once, and only by the user who owns the turn", async () => {
    const conversation = await newConversation(alice.user);
    await store.storePendingConfirmation(conversation.turnId, alice.user.id, confirmation);

    expect(
      await store.spendPendingConfirmation(conversation.turnId, bob.user.id, confirmation.id),
    ).toBe(false);
    expect(
      await store.spendPendingConfirmation(conversation.turnId, alice.user.id, "other-id"),
    ).toBe(false);
    const spends = await Promise.all([
      store.spendPendingConfirmation(conversation.turnId, alice.user.id, confirmation.id),
      store.spendPendingConfirmation(conversation.turnId, alice.user.id, confirmation.id),
    ]);

    expect(spends.filter(Boolean)).toHaveLength(1);
  });
});
