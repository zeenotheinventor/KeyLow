import { assert, assertEquals, assertObjectMatch } from "@std/assert";

import { executeTool } from "../executor.ts";
import { undoAction } from "../undo.ts";
import { createRecipeTool } from "./createRecipe.ts";
import {
  chickenAndRice,
  chickenId,
  oliveOilId,
  otherUserId,
  recipeContext,
  recipeRow,
  riceId,
  tablespoonId,
} from "./recipeFixtures.ts";
import { payloadOf } from "./testing.ts";
import { largeEggId, structuredOf } from "./writeFixtures.ts";
import { updateRecipeTool } from "./updateRecipe.ts";

// Recipes are made through the create tool, so the stored ingredients are the ones the repos build.
async function savedChickenAndRice() {
  const made = recipeContext([createRecipeTool, updateRecipeTool]);
  const created = await executeTool(made.ctx, "create_recipe", chickenAndRice);
  assert(created.status === "ok");
  const [row] = made.stub.tables["recipes"] ?? [];
  return { ...made, id: String(row?.["id"]), row };
}

// What a call leaves null, so a test names only the fields it changes.
const keep = { name: null, servings: null, ingredients: null, steps: null };

Deno.test(
  "a new name and servings keep the ingredients and steps, and build the card",
  async () => {
    const { ctx, id, row, stub, store } = await savedChickenAndRice();
    const ingredientsBefore = structuredClone(row?.["recipe_ingredients"]);

    const result = await executeTool(ctx, "update_recipe", {
      ...keep,
      id,
      name: "Chicken rice bowls",
      servings: 2,
    });

    assertEquals(result.status, "ok");
    assertObjectMatch(structuredOf(result), {
      card: {
        kind: "recipe_updated",
        title: "Updated recipe Chicken rice bowls",
        sub: "Per serving 1,101 kcal · P 74 g · C 158 g · F 17 g",
        note: "Undo is off for changes. Edit it again in the recipe editor.",
        link: { label: "Open in recipe editor", target: { screen: "recipe_editor", recipeId: id } },
        undo: "unavailable",
        undoneSub: null,
      },
    });
    const [after] = stub.tables["recipes"] ?? [];
    assertObjectMatch(after ?? {}, {
      name: "Chicken rice bowls",
      servings: 2,
      instructions: chickenAndRice.steps,
      is_archived: false,
    });
    assertEquals(after?.["recipe_ingredients"], ingredientsBefore);
    assertEquals(store.actions.length, 2);
    const action = store.actions[1];
    assertEquals(action?.tool, "update_recipe");
    assertEquals(action?.targetTable, "recipes");
    assertEquals(action?.targetId, id);
    assertEquals(action?.targetUpdatedAt, null);
  },
);

Deno.test("new ingredients replace the old ones and the numbers are worked out again", async () => {
  const { ctx, id, stub } = await savedChickenAndRice();

  const result = await executeTool(ctx, "update_recipe", {
    ...keep,
    id,
    ingredients: [
      { food_id: chickenId, unit: "g", amount: 400, portion_id: null },
      { food_id: riceId, unit: "g", amount: 200, portion_id: null },
    ],
  });

  assertEquals(result.status, "ok");
  const [after] = stub.tables["recipes"] ?? [];
  assertEquals(
    ((after?.["recipe_ingredients"] ?? []) as Record<string, unknown>[]).map((i) => [
      i["position"],
      i["food_id"],
      i["quantity"],
    ]),
    [
      [0, chickenId, 400],
      [1, riceId, 200],
    ],
  );
  // 400 g chicken is 424 kcal and 200 g rice 714 kcal, over 4 servings.
  assertObjectMatch(payloadOf(result) as object, {
    updated: { per_serving: { kcal: 284.5 } },
  });
  assertEquals(after?.["servings"], 4);
});

Deno.test("new steps replace the old ones, and an empty list clears them", async () => {
  const { ctx, id, stub } = await savedChickenAndRice();

  await executeTool(ctx, "update_recipe", { ...keep, id, steps: ["Boil.", "Eat."] });
  assertEquals(stub.tables["recipes"]?.[0]?.["instructions"], ["Boil.", "Eat."]);
  await executeTool(ctx, "update_recipe", { ...keep, id, steps: [] });

  assertEquals(stub.tables["recipes"]?.[0]?.["instructions"], []);
});

Deno.test("a recipe's link and its archived flag are not touched by an edit", async () => {
  const { ctx, id, stub } = await savedChickenAndRice();
  Object.assign(stub.tables["recipes"]?.[0] ?? {}, {
    source_url: "https://example.com/chicken-and-rice",
    is_archived: true,
  });

  await executeTool(ctx, "update_recipe", { ...keep, id, name: "Chicken and rice, again" });

  assertObjectMatch(stub.tables["recipes"]?.[0] ?? {}, {
    source_url: "https://example.com/chicken-and-rice",
    is_archived: true,
  });
});

Deno.test("a call that changes nothing is invalid_input", async () => {
  const { ctx, id, stub } = await savedChickenAndRice();
  const before = structuredClone(stub.tables["recipes"]);

  const result = await executeTool(ctx, "update_recipe", { ...keep, id });

  assertEquals(payloadOf(result), { error: "invalid_input", fields: ["name"] });
  assertEquals(stub.tables["recipes"], before);
});

Deno.test("a portion of another food, or a food that is not there, changes nothing", async () => {
  const { ctx, id, stub } = await savedChickenAndRice();
  const before = structuredClone(stub.tables["recipes"]);

  const wrongPortion = await executeTool(ctx, "update_recipe", {
    ...keep,
    id,
    ingredients: [{ food_id: oliveOilId, unit: "portion", amount: 1, portion_id: largeEggId }],
  });
  const noFood = await executeTool(ctx, "update_recipe", {
    ...keep,
    id,
    ingredients: [
      { food_id: "00000000-0000-4000-8000-0000000000ff", unit: "g", amount: 1, portion_id: null },
    ],
  });
  const rightPortion = {
    food_id: oliveOilId,
    unit: "portion",
    amount: 1,
    portion_id: tablespoonId,
  };

  assertEquals(payloadOf(wrongPortion), {
    error: "invalid_input",
    fields: ["ingredients.0.portion_id"],
  });
  assertEquals(payloadOf(noFood), { error: "not_found", fields: ["ingredients.0.food_id"] });
  assertEquals(stub.tables["recipes"], before);
  assertEquals(
    (await executeTool(ctx, "update_recipe", { ...keep, id, ingredients: [rightPortion] })).status,
    "ok",
  );
});

Deno.test("bad values are named by the executor, as they are on create", async () => {
  const { ctx, id } = await savedChickenAndRice();
  const cases: [Record<string, unknown>, string][] = [
    [{ name: "  " }, "name"],
    [{ servings: 0 }, "servings"],
    [{ ingredients: [] }, "ingredients"],
    [{ steps: ["x".repeat(1001)] }, "steps.0"],
    [{ id: "not-an-id", name: "Soup" }, "id"],
  ];
  for (const [change, field] of cases) {
    const result = await executeTool(ctx, "update_recipe", { ...keep, id, ...change });

    assertEquals(payloadOf(result), { error: "invalid_input", fields: [field] });
  }
});

Deno.test("another user's recipe, and one that is not there, are not_found", async () => {
  const theirs = recipeRow({ id: "00000000-0000-4000-8000-0000000e9003", owner_id: otherUserId });
  const { ctx, stub } = recipeContext([updateRecipeTool], { rows: { recipes: [theirs] } });

  for (const id of [theirs.id, "00000000-0000-4000-8000-0000000e9fff"]) {
    const result = await executeTool(ctx, "update_recipe", { ...keep, id, name: "Mine now" });

    assertEquals(payloadOf(result), { error: "not_found" });
  }
  assertEquals(stub.tables["recipes"]?.[0]?.["name"], "Pasta bake");
});

Deno.test("an edit has no Undo", async () => {
  const { ctx, id } = await savedChickenAndRice();
  const result = await executeTool(ctx, "update_recipe", { ...keep, id, servings: 8 });
  assert(result.status === "ok" && result.actionId !== null);

  const undone = await undoAction(ctx, result.actionId);

  assertEquals(undone, { status: "error", code: "undo_unavailable" });
  assertEquals(updateRecipeTool.inverse, null);
});
