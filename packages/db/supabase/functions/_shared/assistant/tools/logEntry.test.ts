import { assert, assertEquals, assertFalse, assertObjectMatch } from "@std/assert";

import { executeTool } from "../executor.ts";
import { spyOnConsole } from "../testing.ts";
import { undoAction } from "../undo.ts";
import { logEntryTool } from "./logEntry.ts";
import { payloadOf } from "./testing.ts";
import {
  bucketId,
  bucketPortionId,
  deletedFoodId,
  dietWithBucket,
  eggId,
  largeEggId,
  sliceId,
  structuredOf,
  toastId,
  writeContext,
} from "./writeFixtures.ts";

// The fields a call leaves null, so a test names only the ones it sets.
const none = {
  food_id: null,
  portion_id: null,
  count: null,
  grams: null,
  ml: null,
  recipe_id: null,
  servings: null,
  kcal: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  label: null,
  local_date: null,
  time: null,
};
const twoEggs = { ...none, kind: "portion", food_id: eggId, portion_id: largeEggId, count: 2 };

const setUp = (localTime: string | null = "08:10") => writeContext([logEntryTool], { localTime });

Deno.test("a portion of another food is invalid_input and nothing is written", async () => {
  const { ctx, stub, store } = setUp();

  const result = await executeTool(ctx, "log_entry", { ...twoEggs, portion_id: sliceId });

  assertEquals(result.status, "ok");
  assertEquals(payloadOf(result), { error: "invalid_input", fields: ["portion_id"] });
  assertEquals(stub.tables["food_log_entries"] ?? [], []);
  assertEquals(store.actions.length, 0);
});

Deno.test("a deleted food is refused without the model having looked it up", async () => {
  const { ctx, stub } = setUp();

  const result = await executeTool(ctx, "log_entry", {
    ...none,
    kind: "grams",
    food_id: deletedFoodId,
    grams: 100,
  });

  assertEquals(payloadOf(result), { error: "not_found" });
  assertEquals(stub.tables["food_log_entries"] ?? [], []);
});

Deno.test(
  "fields that do not belong to the kind, or are missing, are named by the executor",
  async () => {
    const { ctx } = setUp();
    const cases: [Record<string, unknown>, string][] = [
      [{ ...twoEggs, grams: 100 }, "grams"],
      [{ ...twoEggs, count: null }, "count"],
      [
        { ...none, kind: "grams", food_id: eggId, grams: 100, portion_id: largeEggId },
        "portion_id",
      ],
      [{ ...none, kind: "quick" }, "kcal"],
      [{ ...none, kind: "quick", kcal: 300, food_id: eggId }, "food_id"],
    ];
    for (const [input, field] of cases) {
      const result = await executeTool(ctx, "log_entry", input);

      assertEquals(result.status, "error");
      assertEquals(payloadOf(result), { error: "invalid_input", fields: [field] });
    }
  },
);

Deno.test(
  "two eggs at 08:10 log one frozen entry with the portion and build the board's card",
  async () => {
    const { ctx, stub, store } = setUp();

    const result = await executeTool(ctx, "log_entry", twoEggs);

    assertEquals(result.status, "ok");
    assertObjectMatch(structuredOf(result), {
      card: {
        kind: "logged",
        title: "Logged 2 eggs at 08:10",
        totalText: "144 kcal · P 13 g · C 0.8 g · F 9.5 g",
        undo: "available",
        undoneSub: "Removed 2 eggs from 08:10",
        rows: [
          {
            name: "Egg, boiled",
            amountText: "2 large eggs (100 g)",
            time: "08:10",
            kcalText: "144 kcal",
          },
        ],
      },
    });
    const [row] = stub.tables["food_log_entries"] ?? [];
    assertObjectMatch(row ?? {}, {
      item_type: "food",
      food_id: eggId,
      portion_id: largeEggId,
      quantity: 2,
      unit: "portion",
      resolved_grams: 100,
      local_date: "2026-11-03",
      logged_at: "2026-11-03T08:10:00.000Z",
    });
    assertObjectMatch(row?.["snapshot"] ?? {}, {
      name: "Egg, boiled",
      portion: { label: "large egg", grams: 50 },
    });
    // The action holds ids and the stamp the database gave the row, and no value.
    assertObjectMatch(store.actions[0] ?? {}, {
      tool: "log_entry",
      targetTable: "food_log_entries",
      targetId: row?.["id"],
      targetUpdatedAt: row?.["updated_at"],
    });
    assertFalse(JSON.stringify(store.actions).includes("Egg"));
    assertFalse(JSON.stringify(store.actions).includes("kcal"));
  },
);

Deno.test(
  "the day and the time default to the turn's and give way to what the person named",
  async () => {
    const defaults = setUp("08:10");
    await executeTool(defaults.ctx, "log_entry", twoEggs);
    const named = setUp("08:10");
    await executeTool(named.ctx, "log_entry", {
      ...twoEggs,
      local_date: "2026-11-02",
      time: "13:00",
    });

    assertObjectMatch(defaults.stub.tables["food_log_entries"]?.[0] ?? {}, {
      local_date: "2026-11-03",
      logged_at: "2026-11-03T08:10:00.000Z",
    });
    assertObjectMatch(named.stub.tables["food_log_entries"]?.[0] ?? {}, {
      local_date: "2026-11-02",
      logged_at: "2026-11-02T13:00:00.000Z",
    });
  },
);

Deno.test(
  "grams the person said are logged as grams, and a quick add as the calories given",
  async () => {
    const { ctx, stub } = setUp();

    await executeTool(ctx, "log_entry", { ...none, kind: "grams", food_id: toastId, grams: 60 });
    await executeTool(ctx, "log_entry", {
      ...none,
      kind: "quick",
      kcal: 300,
      label: "Flat white",
      time: "07:30",
    });

    const [grams, quick] = stub.tables["food_log_entries"] ?? [];
    assertObjectMatch(grams ?? {}, { unit: "g", quantity: 60, portion_id: null });
    assertObjectMatch(quick ?? {}, { item_type: "quick", logged_at: "2026-11-03T07:30:00.000Z" });
    assertObjectMatch(quick?.["nutrients"] ?? {}, { kcal: 300, protein_g: null });
  },
);

Deno.test(
  "a count of a bucket with no published weight is logged as portions, with no grams",
  async () => {
    const { ctx, stub } = writeContext([logEntryTool], { rows: dietWithBucket() });

    const result = await executeTool(ctx, "log_entry", {
      ...none,
      kind: "portion",
      food_id: bucketId,
      portion_id: bucketPortionId,
      count: 1.5,
    });

    assertEquals(result.status, "ok");
    const [row] = stub.tables["food_log_entries"] ?? [];
    assertObjectMatch(row ?? {}, { unit: "portion", quantity: 1.5, resolved_grams: 0 });
    assertObjectMatch(row?.["nutrients"] ?? {}, { kcal: 750 });
    assertFalse(JSON.stringify(payloadOf(result)).includes("100 g"));
  },
);

Deno.test(
  "a bucket with no published weight logged in grams is refused as invalid_input",
  async () => {
    const { ctx, stub, store } = writeContext([logEntryTool], { rows: dietWithBucket() });

    const result = await executeTool(ctx, "log_entry", {
      ...none,
      kind: "grams",
      food_id: bucketId,
      grams: 400,
    });

    assertEquals(payloadOf(result), { error: "invalid_input", fields: ["grams"] });
    assertEquals(stub.tables["food_log_entries"] ?? [], []);
    assertEquals(store.actions.length, 0);
  },
);

Deno.test("undo removes the entry once, then answers already_undone", async () => {
  const { ctx, stub } = setUp();
  const logged = await executeTool(ctx, "log_entry", twoEggs);
  const actionId = logged.status === "ok" ? logged.actionId : null;
  assert(actionId !== null);

  const first = await undoAction(ctx, actionId);
  const second = await undoAction(ctx, actionId);

  assertEquals(first, { status: "undone", actionId });
  assertEquals(second, { status: "error", code: "already_undone" });
  assertFalse((stub.tables["food_log_entries"] ?? []).some((row) => row["deleted_at"] === null));
});

Deno.test("undo after the entry was edited is undo_unavailable and the entry stays", async () => {
  const { ctx, stub } = setUp();
  const logged = await executeTool(ctx, "log_entry", twoEggs);
  const actionId = logged.status === "ok" ? logged.actionId : null;
  assert(actionId !== null);
  // The person edits the entry in the diary: the database stamps a new updated_at.
  await stub.caller
    .from("food_log_entries")
    .update({ quantity: 3 })
    .eq("id", String(stub.tables["food_log_entries"]?.[0]?.["id"]));

  const result = await undoAction(ctx, actionId);

  assertEquals(result, { status: "error", code: "undo_unavailable" });
  assertEquals(stub.tables["food_log_entries"]?.[0]?.["deleted_at"], null);
  assertEquals(ctx.registry.get("log_entry")?.kind, "write");
});

Deno.test("no name and no nutrient reaches a log line", async () => {
  const spy = spyOnConsole();
  try {
    const { ctx } = setUp();
    await executeTool(ctx, "log_entry", twoEggs);
    await executeTool(ctx, "log_entry", { ...twoEggs, portion_id: sliceId });
  } finally {
    spy.restore();
  }

  const lines = spy.lines.join("\n");
  assertFalse(lines.includes("Egg"));
  assertFalse(lines.includes("kcal"));
});

Deno.test("a failed stamp read still lands the entry, but the card offers no Undo", async () => {
  const { ctx, stub, store, reported } = setUp();
  stub.failNextReadFrom("food_log_entries");

  const result = await executeTool(ctx, "log_entry", twoEggs);

  assertEquals(result.status, "ok");
  assertEquals(stub.tables["food_log_entries"]?.length, 1);
  assertObjectMatch(structuredOf(result), { card: { undo: "unavailable", undoneSub: null } });
  assertEquals(store.actions[0]?.targetUpdatedAt, null);
  assertEquals(reported.length, 1);
  const actionId = result.status === "ok" ? result.actionId : null;
  assert(actionId !== null);
  assertEquals(await undoAction(ctx, actionId), { status: "error", code: "undo_unavailable" });
});

Deno.test("an edit between the read and the delete of an undo is not deleted over", async () => {
  const { ctx, stub } = setUp();
  const logged = await executeTool(ctx, "log_entry", twoEggs);
  const actionId = logged.status === "ok" ? logged.actionId : null;
  assert(actionId !== null);
  const id = String(stub.tables["food_log_entries"]?.[0]?.["id"]);
  stub.beforeNextWriteTo("food_log_entries", () => {
    // The person edits the entry just after Undo read its stamp.
    const row = stub.tables["food_log_entries"]?.[0];
    if (row !== undefined) {
      Object.assign(row, { quantity: 3, updated_at: "2026-11-03T09:30:00.000000+00:00" });
    }
  });

  const result = await undoAction(ctx, actionId);

  assertEquals(result, { status: "error", code: "undo_unavailable" });
  assertEquals(stub.tables["food_log_entries"]?.[0]?.["deleted_at"], null);
  assertEquals(stub.tables["food_log_entries"]?.[0]?.["id"], id);
});
