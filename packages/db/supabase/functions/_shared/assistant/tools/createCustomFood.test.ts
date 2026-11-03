import { assert, assertEquals, assertObjectMatch } from "@std/assert";

import { executeTool } from "../executor.ts";
import { userId } from "../testing.ts";
import { undoAction } from "../undo.ts";
import { createCustomFoodTool } from "./createCustomFood.ts";
import { payloadOf } from "./testing.ts";
import { foodRow, structuredOf, writeContext } from "./writeFixtures.ts";

const proteinBar = {
  name: "My protein bar",
  brand: null,
  per: "per_portion",
  portion_label: "1 bar",
  portion_grams: 60,
  kcal: 210,
  protein_g: 20,
  carbs_g: 19,
  fat_g: 6,
};

const contextWith = () => {
  const { ctx, stub, store } = writeContext([createCustomFoodTool]);
  return { ctx, stub, store };
};

const ownFoods = (stub: ReturnType<typeof contextWith>["stub"]) =>
  (stub.tables["foods"] ?? []).filter((food) => food["name"] === "My protein bar");

Deno.test(
  "the protein bar is saved as the user's own food with one portion, and builds the board's card",
  async () => {
    const { ctx, stub } = contextWith();

    const result = await executeTool(ctx, "create_custom_food", proteinBar);

    assertEquals(result.status, "ok");
    const [food] = ownFoods(stub);
    assertObjectMatch(food ?? {}, {
      source: "user",
      owner_id: userId,
      basis: "per_100g",
      kcal: 350,
      protein_g: 33.33,
      carbs_g: 31.67,
      fat_g: 10,
    });
    assertObjectMatch(stub.tables["food_portions"]?.at(-1) ?? {}, {
      food_id: food?.["id"],
      label: "1 bar",
      grams: 60,
      is_default: true,
    });
    assertObjectMatch(structuredOf(result), {
      card: {
        kind: "food_created",
        title: "Added food My protein bar",
        sub: "Yours · 1 bar",
        rows: [{ name: "Per bar", amountText: "P 20 g · C 19 g · F 6 g", kcalText: "210 kcal" }],
        note: "Not logged yet. Say when you had it, or log it from search.",
        link: { label: "Open in your foods", target: { screen: "own_food", foodId: food?.["id"] } },
        undo: "available",
      },
    });
    assertObjectMatch(payloadOf(result) as Record<string, unknown>, { logged: false });
  },
);

Deno.test("it creates no diary entry", async () => {
  const { ctx, stub } = contextWith();

  await executeTool(ctx, "create_custom_food", proteinBar);

  assertEquals(stub.tables["food_log_entries"] ?? [], []);
  assertEquals(
    stub.calls.filter((call) => call.table === "food_log_entries"),
    [],
  );
});

Deno.test(
  "a label whose kcal is more than 15 percent from its macros is refused and names the macros' kcal",
  async () => {
    const { ctx, stub, store } = contextWith();

    const result = await executeTool(ctx, "create_custom_food", { ...proteinBar, kcal: 260 });

    assertEquals(result.status, "ok");
    assertEquals(payloadOf(result), { error: "invalid_input", fields: ["kcal"], macro_kcal: 210 });
    assertEquals(ownFoods(stub), []);
    assertEquals(store.actions.length, 0);
  },
);

Deno.test("a per portion label without its weight is refused naming the field", async () => {
  const { ctx, stub } = contextWith();

  const result = await executeTool(ctx, "create_custom_food", {
    ...proteinBar,
    portion_grams: null,
  });

  assertEquals(payloadOf(result), { error: "invalid_input", fields: ["portion_grams"] });
  assertEquals(ownFoods(stub), []);
});

Deno.test("a per 100 g label is saved with no portion and the card says Per 100 g", async () => {
  const { ctx, stub } = contextWith();

  const result = await executeTool(ctx, "create_custom_food", {
    ...proteinBar,
    brand: "Acme",
    per: "per_100g",
    portion_label: null,
    portion_grams: null,
    kcal: 400,
    protein_g: 30,
    carbs_g: 40,
    fat_g: 13,
  });

  assertEquals(result.status, "ok");
  assertObjectMatch(ownFoods(stub)[0] ?? {}, { brand: "Acme", kcal: 400 });
  assertObjectMatch(structuredOf(result), {
    card: { sub: "Yours", rows: [{ name: "Per 100 g", kcalText: "400 kcal" }] },
  });
});

Deno.test("one action row holds the food's id and no value", async () => {
  const { ctx, stub, store } = contextWith();

  const result = await executeTool(ctx, "create_custom_food", proteinBar);

  assert(result.status === "ok" && result.actionId !== null);
  const [action] = store.actions;
  assertEquals(store.actions.length, 1);
  assertEquals(action?.targetTable, "foods");
  assertEquals(action?.targetId, ownFoods(stub)[0]?.["id"]);
  assertEquals(action?.targetIds, null);
  assertEquals(action?.targetLocalDate, null);
  assertEquals(action?.targetUpdatedAt, null);
});

Deno.test(
  "a failed portion write hides the food and fails the call without quoting the row",
  async () => {
    const { ctx, stub, store } = contextWith();
    stub.failNextWriteTo("food_portions");

    const result = await executeTool(ctx, "create_custom_food", proteinBar);

    assertEquals(result.status, "error");
    assertEquals(result.status === "error" && result.code, "tool_failed");
    assertEquals(store.actions.length, 0);
    assert(ownFoods(stub).every((food) => food["deleted_at"] !== null));
    assert(!JSON.stringify(result).includes("My protein bar"));
  },
);

Deno.test("Undo hides the food, and a second Undo is already_undone", async () => {
  const { ctx, stub } = contextWith();
  const created = await executeTool(ctx, "create_custom_food", proteinBar);
  assert(created.status === "ok" && created.actionId !== null);

  const first = await undoAction(ctx, created.actionId);
  const second = await undoAction(ctx, created.actionId);

  assertEquals(first, { status: "undone", actionId: created.actionId });
  assertEquals(second, { status: "error", code: "already_undone" });
  assert(ownFoods(stub)[0]?.["deleted_at"] !== null);
});

Deno.test("Undo is unavailable once the person deleted the food themselves", async () => {
  const { ctx, stub } = contextWith();
  const created = await executeTool(ctx, "create_custom_food", proteinBar);
  assert(created.status === "ok" && created.actionId !== null);
  Object.assign(ownFoods(stub)[0] ?? {}, { deleted_at: "2026-11-03T09:30:00+00:00" });

  const result = await undoAction(ctx, created.actionId);

  assertEquals(result, { status: "error", code: "undo_unavailable" });
});

Deno.test("another user's food in an action cannot be hidden by this user", async () => {
  const { ctx, stub, store } = writeContext([createCustomFoodTool], {
    rows: {
      foods: [
        foodRow({
          id: "00000000-0000-4000-8000-0000000ff001",
          name: "Their bar",
          owner_id: "00000000-0000-4000-8000-0000000000b2",
          kcal: 300,
          protein_g: 10,
          fat_g: 10,
          carbs_g: 30,
        }),
      ],
    },
  });
  store.actions.push({
    id: "action-theirs",
    userId,
    conversationId: ctx.turn.conversationId,
    turnId: ctx.turn.id,
    turnSeq: 1,
    tool: "create_custom_food",
    targetTable: "foods",
    targetId: "00000000-0000-4000-8000-0000000ff001",
    targetIds: null,
    targetLocalDate: null,
    targetUpdatedAt: null,
    undoneAt: null,
  });

  const result = await undoAction(ctx, "action-theirs");

  assertEquals(result, { status: "error", code: "undo_unavailable" });
  assertEquals(
    stub.tables["foods"]?.find((food) => food["name"] === "Their bar")?.["deleted_at"],
    null,
  );
});
