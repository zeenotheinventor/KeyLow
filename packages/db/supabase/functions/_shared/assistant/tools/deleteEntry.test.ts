import { assert, assertEquals, assertFalse, assertObjectMatch } from "@std/assert";

import { executeTool } from "../executor.ts";
import {
  createFakeActionStore,
  createFakeContext,
  turnsOfConversation,
  userId,
} from "../testing.ts";
import { undoAction } from "../undo.ts";
import { deleteEntryTool } from "./deleteEntry.ts";
import { logEntryTool } from "./logEntry.ts";
import { payloadOf } from "./testing.ts";
import { dietRows, structuredOf } from "./writeFixtures.ts";
import { writeStub } from "./writeStub.ts";

import type { ToolContext } from "../tool.ts";

const earlier = "00000000-0000-4000-8000-0000000000d1";
const later = "00000000-0000-4000-8000-0000000000d2";
const otherUser = "00000000-0000-4000-8000-0000000000b2";

const quick = (label: string) => ({
  kind: "quick",
  food_id: null,
  portion_id: null,
  count: null,
  grams: null,
  ml: null,
  recipe_id: null,
  servings: null,
  kcal: 200,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  label,
  local_date: null,
  time: "13:00",
});

// A diary that holds three entries at 13:00, logged through the log tool, and a fourth that is
// another user's. The contexts are the earlier turn, where the model asks, and the later one, where the
// user has said yes.
async function diaryOfThree() {
  const stub = writeStub(
    {
      ...dietRows(),
      food_log_entries: [
        {
          id: "00000000-0000-4000-8000-0000000a0001",
          user_id: otherUser,
          local_date: "2026-11-03",
          logged_at: "2026-11-03T13:00:00.000Z",
          item_type: "quick",
          snapshot: { v: 1, kind: "quick", label: "Hers" },
          nutrients: { kcal: 1, protein_g: null, fat_g: null, carbs_g: null, fibre_g: null },
          deleted_at: null,
          updated_at: "2026-11-01T00:00:00+00:00",
        },
      ],
    },
    { callerUserId: userId },
  );
  const store = createFakeActionStore({ turns: turnsOfConversation([earlier, later]) });
  const contextOn = (turnId: string): ToolContext => {
    const made = createFakeContext([logEntryTool, deleteEntryTool], {
      store,
      turn: { id: turnId, conversationId: store.turns[0]?.conversationId ?? "" },
      localDate: "2026-11-03",
      localTime: "13:00",
    });
    return { ...made.ctx, caller: stub.caller };
  };
  const logging = contextOn(earlier);
  for (const label of ["Chicken and rice", "Greek yoghurt", "apple"]) {
    await executeTool(logging, "log_entry", quick(label));
  }
  const ids = (stub.tables["food_log_entries"] ?? [])
    .filter((row) => row["user_id"] === userId)
    .map((row) => String(row["id"]));
  return { stub, store, ids, asking: contextOn(earlier), confirming: contextOn(later) };
}

Deno.test("deleting three entries answers needs_confirmation and deletes nothing", async () => {
  const { asking, stub, ids } = await diaryOfThree();

  const result = await executeTool(asking, "delete_entry", { ids });

  assertEquals(result.status, "needs_confirmation");
  assertEquals(Object.keys(payloadOf(result) as object).sort(), ["confirmation_id", "status"]);
  assertFalse((stub.tables["food_log_entries"] ?? []).some((row) => row["deleted_at"] !== null));
});

Deno.test(
  "with the spent confirmation it deletes the three in one slot and builds the board's title",
  async () => {
    const { asking, confirming, stub, store, ids } = await diaryOfThree();
    const asked = await executeTool(asking, "delete_entry", { ids });
    assert(asked.status === "needs_confirmation");

    const result = await executeTool(confirming, "delete_entry", {
      ids,
      confirmation_id: asked.confirmationId,
    });

    assertEquals(result.status, "ok");
    assertObjectMatch(structuredOf(result), {
      card: {
        kind: "deleted",
        title: "3 entries deleted",
        sub: "Chicken and rice, Greek yoghurt and apple · 13:00",
        undo: "available",
        undoneSub: "Restored 3 entries from 13:00",
      },
    });
    const mine = (stub.tables["food_log_entries"] ?? []).filter((row) => row["user_id"] === userId);
    assert(mine.every((row) => row["deleted_at"] !== null));
    const deletes = store.actions.filter((action) => action.tool === "delete_entry");
    assertEquals(deletes.length, 1);
    assertEquals([...(deletes[0]?.targetIds ?? [])].sort(), [...ids].sort());
    assertEquals(deletes[0]?.targetUpdatedAt, mine[0]?.["updated_at"]);
    assertFalse(JSON.stringify(store.actions).includes("apple"));
  },
);

Deno.test("a single id needs no confirmation, and another user's id deletes nothing", async () => {
  const { asking, stub, ids } = await diaryOfThree();

  const single = await executeTool(asking, "delete_entry", { ids: [ids[0]] });
  const foreign = await executeTool(asking, "delete_entry", {
    ids: ["00000000-0000-4000-8000-0000000a0001"],
  });

  assertEquals(single.status, "ok");
  assertEquals(payloadOf(foreign), { error: "not_found" });
  const theirs = (stub.tables["food_log_entries"] ?? []).find(
    (row) => row["user_id"] === otherUser,
  );
  assertEquals(theirs?.["deleted_at"], null);
});

Deno.test(
  "undo restores the entries, and not when one was changed in the diary since",
  async () => {
    const { asking, confirming, stub, ids } = await diaryOfThree();
    const asked = await executeTool(asking, "delete_entry", { ids });
    assert(asked.status === "needs_confirmation");
    const deleted = await executeTool(confirming, "delete_entry", {
      ids,
      confirmation_id: asked.confirmationId,
    });
    assert(deleted.status === "ok" && deleted.actionId !== null);

    // The person restores one of them in the diary, which moves its stamp.
    await stub.caller
      .from("food_log_entries")
      .update({ deleted_at: null })
      .eq("id", String(ids[0]));
    const refused = await undoAction(confirming, deleted.actionId);
    assertEquals(refused, { status: "error", code: "undo_unavailable" });
  },
);

Deno.test("undo brings back all the entries it deleted", async () => {
  const { asking, confirming, stub, ids } = await diaryOfThree();
  const asked = await executeTool(asking, "delete_entry", { ids });
  assert(asked.status === "needs_confirmation");
  const deleted = await executeTool(confirming, "delete_entry", {
    ids,
    confirmation_id: asked.confirmationId,
  });
  assert(deleted.status === "ok" && deleted.actionId !== null);

  const result = await undoAction(confirming, deleted.actionId);

  assertEquals(result, { status: "undone", actionId: deleted.actionId });
  const mine = (stub.tables["food_log_entries"] ?? []).filter((row) => row["user_id"] === userId);
  assert(mine.every((row) => row["deleted_at"] === null));
});
