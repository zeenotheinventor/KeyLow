import { assert, assertEquals, assertObjectMatch } from "@std/assert";

import { executeTool } from "../executor.ts";
import {
  createFakeActionStore,
  createFakeContext,
  turnsOfConversation,
  userId,
} from "../testing.ts";
import { undoAction } from "../undo.ts";
import { archiveRecipeTool } from "./archiveRecipe.ts";
import { otherUserId, recipeContext, recipeRow } from "./recipeFixtures.ts";
import { payloadOf } from "./testing.ts";
import { structuredOf } from "./writeFixtures.ts";

import type { ToolContext } from "../tool.ts";

const earlier = "00000000-0000-4000-8000-0000000000d1";
const later = "00000000-0000-4000-8000-0000000000d2";
const chickenAndRice = recipeRow({
  id: "00000000-0000-4000-8000-0000000e9002",
  name: "Chicken and rice",
});
const theirs = recipeRow({
  id: "00000000-0000-4000-8000-0000000e9003",
  name: "Their stew",
  owner_id: otherUserId,
});

// The earlier turn is where the model asks and the later one where the user has said yes.
function archiveContexts(rows = [chickenAndRice, theirs]) {
  const base = recipeContext([archiveRecipeTool], { rows: { recipes: rows } });
  const store = createFakeActionStore({ turns: turnsOfConversation([earlier, later]) });
  const contextOn = (turnId: string): ToolContext => ({
    ...createFakeContext([archiveRecipeTool], {
      store,
      turn: { id: turnId, conversationId: store.turns[0]?.conversationId ?? "" },
    }).ctx,
    caller: base.stub.caller,
  });
  return { stub: base.stub, store, asking: contextOn(earlier), confirming: contextOn(later) };
}

const archivedFlags = (stub: ReturnType<typeof archiveContexts>["stub"]) =>
  Object.fromEntries(
    (stub.tables["recipes"] ?? []).map((row) => [row["name"], row["is_archived"]]),
  );

const confirmationIdOf = (result: Awaited<ReturnType<typeof executeTool>>) => {
  assert(result.status === "needs_confirmation");
  return result.confirmationId;
};

Deno.test("archiving asks first and writes nothing until the user says yes", async () => {
  const { asking, stub, store } = archiveContexts();

  const result = await executeTool(asking, "archive_recipe", { id: chickenAndRice.id });

  assertEquals(result.status, "needs_confirmation");
  assertEquals(archivedFlags(stub), { "Chicken and rice": false, "Their stew": false });
  assertEquals(store.actions.length, 0);
  assertEquals(store.turns[0]?.pending?.tool, "archive_recipe");
});

Deno.test("the spent confirmation archives the recipe and builds the card with Undo", async () => {
  const { asking, confirming, stub, store } = archiveContexts();
  const confirmationId = confirmationIdOf(
    await executeTool(asking, "archive_recipe", { id: chickenAndRice.id }),
  );

  const result = await executeTool(confirming, "archive_recipe", {
    id: chickenAndRice.id,
    confirmation_id: confirmationId,
  });

  assertEquals(result.status, "ok");
  assertEquals(payloadOf(result), { id: chickenAndRice.id, archived: true, changed: true });
  assertObjectMatch(structuredOf(result), {
    card: {
      kind: "recipe_archived",
      title: "Archived recipe Chicken and rice",
      sub: null,
      link: null,
      undo: "available",
      undoneSub: "Restored Chicken and rice",
    },
  });
  assertEquals(archivedFlags(stub), { "Chicken and rice": true, "Their stew": false });
  const [action] = store.actions;
  assertEquals(action?.tool, "archive_recipe");
  assertEquals(action?.targetTable, "recipes");
  assertEquals(action?.targetId, chickenAndRice.id);
  assertEquals(action?.targetUpdatedAt, null);
});

Deno.test(
  "a confirmation is for the recipe it was asked about, and a replay after archiving changes nothing",
  async () => {
    const { asking, confirming, stub, store } = archiveContexts([
      chickenAndRice,
      recipeRow({ id: "00000000-0000-4000-8000-0000000e9004", name: "Pasta bake" }),
    ]);
    const confirmationId = confirmationIdOf(
      await executeTool(asking, "archive_recipe", { id: chickenAndRice.id }),
    );

    const other = await executeTool(confirming, "archive_recipe", {
      id: "00000000-0000-4000-8000-0000000e9004",
      confirmation_id: confirmationId,
    });
    const first = await executeTool(confirming, "archive_recipe", {
      id: chickenAndRice.id,
      confirmation_id: confirmationId,
    });
    const again = await executeTool(confirming, "archive_recipe", {
      id: chickenAndRice.id,
      confirmation_id: confirmationId,
    });

    // Once the recipe is archived, a replay is answered plainly: it asks nothing and writes nothing.
    assertEquals([other.status, first.status, again.status], ["error", "ok", "ok"]);
    assertEquals(payloadOf(again), { id: chickenAndRice.id, archived: true, changed: false });
    assertEquals(store.actions.length, 1);
    assertEquals(archivedFlags(stub), { "Chicken and rice": true, "Pasta bake": false });
  },
);

Deno.test(
  "a recipe that is not the user's, or not there, is not_found with no question and no write",
  async () => {
    const { asking, stub, store } = archiveContexts();

    for (const id of [theirs.id, "00000000-0000-4000-8000-0000000e9fff"]) {
      const result = await executeTool(asking, "archive_recipe", { id });

      assertEquals(result.status, "ok");
      assertEquals(payloadOf(result), { error: "not_found" });
    }
    assertEquals(archivedFlags(stub), { "Chicken and rice": false, "Their stew": false });
    assertEquals(store.actions.length, 0);
    assertEquals(store.turns[0]?.pending, null);
  },
);

Deno.test(
  "a recipe that is already archived is answered plainly, with no question and no action",
  async () => {
    const { asking, store } = archiveContexts([
      recipeRow({ ...chickenAndRice, is_archived: true }),
    ]);

    const result = await executeTool(asking, "archive_recipe", { id: chickenAndRice.id });

    assertEquals(result.status, "ok");
    assertEquals(payloadOf(result), { id: chickenAndRice.id, archived: true, changed: false });
    assertEquals(structuredOf(result), {});
    assertEquals(store.actions.length, 0);
    assertEquals(store.turns[0]?.pending, null);
  },
);

Deno.test("Undo restores the recipe, and a second Undo is already_undone", async () => {
  const { asking, confirming, stub } = archiveContexts();
  const confirmationId = confirmationIdOf(
    await executeTool(asking, "archive_recipe", { id: chickenAndRice.id }),
  );
  const archived = await executeTool(confirming, "archive_recipe", {
    id: chickenAndRice.id,
    confirmation_id: confirmationId,
  });
  assert(archived.status === "ok" && archived.actionId !== null);

  const first = await undoAction(confirming, archived.actionId);
  const second = await undoAction(confirming, archived.actionId);

  assertEquals(first, { status: "undone", actionId: archived.actionId });
  assertEquals(second, { status: "error", code: "already_undone" });
  assertEquals(archivedFlags(stub), { "Chicken and rice": false, "Their stew": false });
});

Deno.test("Undo is unavailable once the person restored the recipe themselves", async () => {
  const { asking, confirming, stub } = archiveContexts();
  const confirmationId = confirmationIdOf(
    await executeTool(asking, "archive_recipe", { id: chickenAndRice.id }),
  );
  const archived = await executeTool(confirming, "archive_recipe", {
    id: chickenAndRice.id,
    confirmation_id: confirmationId,
  });
  assert(archived.status === "ok" && archived.actionId !== null);
  Object.assign(stub.tables["recipes"]?.[0] ?? {}, { is_archived: false });

  const result = await undoAction(confirming, archived.actionId);

  assertEquals(result, { status: "error", code: "undo_unavailable" });
});

Deno.test("another user's id in an action cannot be restored by this user", async () => {
  const { confirming, stub, store } = archiveContexts([
    recipeRow({ ...theirs, is_archived: true }),
  ]);
  store.actions.push({
    id: "action-theirs",
    userId,
    conversationId: confirming.turn.conversationId,
    turnId: later,
    turnSeq: 1,
    tool: "archive_recipe",
    targetTable: "recipes",
    targetId: theirs.id,
    targetIds: null,
    targetLocalDate: null,
    targetUpdatedAt: null,
    undoneAt: null,
  });

  const result = await undoAction(confirming, "action-theirs");

  assertEquals(result, { status: "error", code: "undo_unavailable" });
  assertEquals(archivedFlags(stub), { "Their stew": true });
});
