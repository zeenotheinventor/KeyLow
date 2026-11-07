import { assertEquals, assertRejects } from "@std/assert";

import { conversationId, createFakeActionStore, otherUserId, turnId, userId } from "./testing.ts";
import { createActionStore, reserveNextSlot } from "./store.ts";

import type { ActionRecord, SlotRequest } from "./store.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

const request: SlotRequest = {
  userId,
  conversationId,
  turnId,
  tool: "fake_write",
  targetTable: "log_entries",
};

Deno.test("the first call takes slot 1 and the next takes slot 2", async () => {
  const store = createFakeActionStore();

  const first = await reserveNextSlot(store, request);
  const second = await reserveNextSlot(store, request);

  assertEquals(first.outcome === "reserved" && first.turnSeq, 1);
  assertEquals(second.outcome === "reserved" && second.turnSeq, 2);
});

Deno.test("a released slot is free again, so failed writes do not use up the ten", async () => {
  const store = createFakeActionStore();
  const first = await reserveNextSlot(store, request);
  await reserveNextSlot(store, request);
  if (first.outcome !== "reserved") {
    throw new Error("expected a slot");
  }

  await store.release(first.actionId, userId);
  const third = await reserveNextSlot(store, request);

  assertEquals(third.outcome === "reserved" && third.turnSeq, 1);
});

Deno.test("the eleventh call is refused and takes no slot", async () => {
  const store = createFakeActionStore();
  for (let call = 0; call < 10; call += 1) {
    await reserveNextSlot(store, request);
  }

  const eleventh = await reserveNextSlot(store, request);

  assertEquals(eleventh, { outcome: "limit_reached" });
  assertEquals(store.actions.length, 10);
});

Deno.test(
  "the table's own limit refuses an eleventh even if the loop were to ask for it",
  async () => {
    const store = createFakeActionStore();
    const outcome = await store.insertReservation({ ...request, turnSeq: 11 });

    assertEquals(outcome, { outcome: "over_limit" });
  },
);

Deno.test("the slots of another turn do not count", async () => {
  const store = createFakeActionStore();
  for (let call = 0; call < 10; call += 1) {
    await reserveNextSlot(store, request);
  }

  const elsewhere = await reserveNextSlot(store, {
    ...request,
    turnId: "00000000-0000-4000-8000-0000000000e9",
  });

  assertEquals(elsewhere.outcome === "reserved" && elsewhere.turnSeq, 1);
});

Deno.test("parallel calls that pick the same slot each end up with their own", async () => {
  const store = createFakeActionStore();

  const outcomes = await Promise.all(
    Array.from({ length: 10 }, () => reserveNextSlot(store, request)),
  );

  const slots = outcomes
    .map((o) => (o.outcome === "reserved" ? o.turnSeq : 0))
    .sort((a, b) => a - b);
  assertEquals(slots, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

Deno.test("a reservation that never settles fails loudly and does not loop for ever", async () => {
  const stuck = {
    takenSlots: () => Promise.resolve([]),
    insertReservation: () => Promise.resolve({ outcome: "slot_taken" as const }),
  };

  await assertRejects(() => reserveNextSlot(stuck, request), Error, "did not settle");
});

Deno.test(
  "a slot the table refuses as over the limit is a refusal, whatever the loop read",
  async () => {
    const stale = {
      takenSlots: () => Promise.resolve([]),
      insertReservation: () => Promise.resolve({ outcome: "over_limit" as const }),
    };

    assertEquals(await reserveNextSlot(stale, request), { outcome: "limit_reached" });
  },
);

Deno.test(
  "the previous confirmation is null, and nothing more is read, when the current turn is not found",
  async () => {
    const queried: string[] = [];
    const answer = { data: null, error: null };
    const builder = {
      from: (table: string) => {
        queried.push(`from ${table}`);
        return builder;
      },
      select: () => builder,
      eq: () => builder,
      maybeSingle: () => Promise.resolve(answer),
      lt: () => {
        throw new Error("The previous turn must not be read");
      },
    };
    // The store only calls the methods above. The stub cannot satisfy the whole client type.
    const client = builder as unknown as SupabaseClient;

    const previous = await createActionStore(client).previousPendingConfirmation(
      conversationId,
      userId,
      turnId,
    );

    assertEquals(previous, null);
    assertEquals(queried, ["from assistant_turns"]);
  },
);

// ---- The previous value an Undo reads back (KEY-900) ----

const undoneActionId = "00000000-0000-4000-8000-0000000000f1";

const storedAction: ActionRecord = {
  id: undoneActionId,
  userId,
  conversationId,
  turnId,
  turnSeq: 1,
  tool: "fake_write",
  targetTable: "routines",
  targetId: "row-1",
  targetIds: null,
  targetLocalDate: null,
  targetUpdatedAt: null,
  undoneAt: null,
};

type MessageRow = { turn_id: string | null; user_id: string; display: unknown };

// An in-memory `assistant_messages` that applies the `eq` filters it is sent, so a query that forgets the
// person's id returns another person's row here as it would on the service client.
function messagesClient(
  rows: MessageRow[],
  failure: { code: string; message: string } | null = null,
) {
  const queried: string[] = [];
  const query = (filters: [string, unknown][]) => ({
    eq: (column: string, value: unknown) => query([...filters, [column, value]]),
    then: (resolve: (answer: unknown) => unknown) =>
      resolve(
        failure === null
          ? {
              data: rows
                .filter((row) =>
                  filters.every(([column, value]) =>
                    Object.entries(row).some(([key, actual]) => key === column && actual === value),
                  ),
                )
                .map((row) => ({ display: row.display })),
              error: null,
            }
          : { data: null, error: failure },
      ),
  });
  const builder = {
    from: (table: string) => {
      queried.push(table);
      return { select: () => query([]) };
    },
  };
  // The store only calls the methods above. The stub cannot satisfy the whole client type.
  return { client: builder as unknown as SupabaseClient, queried };
}

const undoDisplay = (actionId: string, previous: unknown) => ({
  "toolu-1": { card: { kind: "changed" }, undo: { actionId, previous, fingerprint: "f-1" } },
});

Deno.test("the previous value is the one stored beside the card of that action", async () => {
  const previous = { name: "Push day", exercises: ["bench", "dips"] };
  const { client } = messagesClient([
    { turn_id: turnId, user_id: userId, display: null },
    { turn_id: turnId, user_id: userId, display: undoDisplay("another-action", { name: "No" }) },
    { turn_id: turnId, user_id: userId, display: undoDisplay(undoneActionId, previous) },
  ]);

  const value = await createActionStore(client).previousValueOf(storedAction, userId);

  assertEquals(value, previous);
});

Deno.test("a stored string comes back exactly as it went in", async () => {
  const deletedAt = "2026-11-03T08:10:00.123456+00:00";
  const { client } = messagesClient([
    { turn_id: turnId, user_id: userId, display: undoDisplay(undoneActionId, { deletedAt }) },
  ]);

  const value = await createActionStore(client).previousValueOf(storedAction, userId);

  assertEquals(value, { deletedAt });
});

Deno.test(
  "another person's action id answers null, whoever the row says owns the action",
  async () => {
    const { client } = messagesClient([
      { turn_id: turnId, user_id: userId, display: undoDisplay(undoneActionId, { name: "Mine" }) },
    ]);

    const value = await createActionStore(client).previousValueOf(
      { ...storedAction, userId: otherUserId },
      otherUserId,
    );

    assertEquals(value, null);
  },
);

Deno.test("an action whose turn is gone answers null and reads nothing", async () => {
  const { client, queried } = messagesClient([]);

  const value = await createActionStore(client).previousValueOf(
    { ...storedAction, turnId: null },
    userId,
  );

  assertEquals(value, null);
  assertEquals(queried, []);
});

Deno.test("a deleted conversation has no messages left, so the answer is null", async () => {
  const { client } = messagesClient([]);

  assertEquals(await createActionStore(client).previousValueOf(storedAction, userId), null);
});

Deno.test("an action with no entry in its turn answers null", async () => {
  const { client } = messagesClient([
    { turn_id: turnId, user_id: userId, display: { "toolu-1": { card: { kind: "changed" } } } },
  ]);

  assertEquals(await createActionStore(client).previousValueOf(storedAction, userId), null);
});

Deno.test("an entry whose undo cannot be read answers null", async () => {
  const { client } = messagesClient([
    { turn_id: turnId, user_id: userId, display: { "toolu-1": { undo: "oops" } } },
    { turn_id: turnId, user_id: userId, display: "oops" },
  ]);

  assertEquals(await createActionStore(client).previousValueOf(storedAction, userId), null);
});

Deno.test(
  "a failed read throws the operation and the code and never the database message",
  async () => {
    const { client } = messagesClient([], { code: "XX000", message: "row 143 kcal leaked" });

    const caught = await createActionStore(client)
      .previousValueOf(storedAction, userId)
      .then(
        () => null,
        (error: unknown) => error,
      );

    assertEquals(
      caught instanceof Error && caught.message,
      "assistant action store read previous value failed XX000",
    );
  },
);
