import { assert, assertEquals, assertObjectMatch } from "@std/assert";

import { executeTool } from "../executor.ts";
import { undoAction } from "../undo.ts";
import { logEntryTool } from "./logEntry.ts";
import { payloadOf } from "./testing.ts";
import { updateEntryTool } from "./updateEntry.ts";
import { eggId, largeEggId, structuredOf, writeContext } from "./writeFixtures.ts";

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
  estimated: null,
  local_date: null,
  time: null,
};

async function withTwoEggs() {
  const made = writeContext([logEntryTool, updateEntryTool]);
  await executeTool(made.ctx, "log_entry", {
    ...none,
    kind: "portion",
    food_id: eggId,
    portion_id: largeEggId,
    count: 2,
  });
  const id = String(made.stub.tables["food_log_entries"]?.[0]?.["id"]);
  return { ...made, id };
}

Deno.test(
  "a new count rebuilds the entry from its own snapshot and the card says Undo is off",
  async () => {
    const { ctx, stub, id } = await withTwoEggs();

    const result = await executeTool(ctx, "update_entry", { id, amount: 3, time: null });

    assertEquals(result.status, "ok");
    assertObjectMatch(stub.tables["food_log_entries"]?.[0] ?? {}, {
      quantity: 3,
      resolved_grams: 150,
    });
    assertObjectMatch(structuredOf(result), {
      card: {
        kind: "updated",
        title: "Changed 3 eggs at 08:10",
        undo: "unavailable",
        undoneSub: null,
      },
    });
  },
);

Deno.test("a new time moves the entry within its day", async () => {
  const { ctx, stub, id } = await withTwoEggs();

  await executeTool(ctx, "update_entry", { id, amount: null, time: "09:30" });

  assertObjectMatch(stub.tables["food_log_entries"]?.[0] ?? {}, {
    logged_at: "2026-11-03T09:30:00.000Z",
    local_date: "2026-11-03",
  });
});

Deno.test("a call that changes nothing and an unknown entry are refused", async () => {
  const { ctx, id } = await withTwoEggs();
  const missing = "00000000-0000-4000-8000-0000000000ff";

  const nothing = await executeTool(ctx, "update_entry", { id, amount: null, time: null });
  const unknown = await executeTool(ctx, "update_entry", { id: missing, amount: 2, time: null });

  assertEquals(nothing.status, "error");
  assertEquals(payloadOf(nothing), { error: "invalid_input", fields: ["amount"] });
  assertEquals(payloadOf(unknown), { error: "not_found" });
});

Deno.test(
  "a count over 50 is refused as log_entry refuses it, and grams keep their own cap",
  async () => {
    const { ctx, stub, id } = await withTwoEggs();

    const tooMany = await executeTool(ctx, "update_entry", { id, amount: 51, time: null });
    const tooBig = await executeTool(ctx, "update_entry", { id, amount: 5001, time: null });

    assertEquals(payloadOf(tooMany), { error: "invalid_input", fields: ["amount"] });
    assertEquals(tooBig.status, "error");
    assertObjectMatch(stub.tables["food_log_entries"]?.[0] ?? {}, { quantity: 2 });
  },
);

Deno.test("an edit has no Undo", async () => {
  const { ctx, id } = await withTwoEggs();
  const updated = await executeTool(ctx, "update_entry", { id, amount: 3, time: null });
  assert(updated.status === "ok" && updated.actionId !== null);

  const result = await undoAction(ctx, updated.actionId);

  assertEquals(result, { status: "error", code: "undo_unavailable" });
});
