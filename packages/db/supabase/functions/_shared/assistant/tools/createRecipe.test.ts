import { assert, assertEquals, assertFalse, assertObjectMatch } from "@std/assert";

import { executeTool } from "../executor.ts";
import { spyOnConsole } from "../testing.ts";
import { undoAction } from "../undo.ts";
import { createRecipeTool } from "./createRecipe.ts";
import {
  chickenAndRice,
  chickenAndRiceIngredients,
  chickenId,
  oliveOilId,
  recipeContext,
  recipeRow,
  riceId,
  tablespoonId,
} from "./recipeFixtures.ts";
import { payloadOf } from "./testing.ts";
import { deletedFoodId, largeEggId, structuredOf } from "./writeFixtures.ts";

const setUp = () => recipeContext([createRecipeTool]);
const recipesOf = (stub: ReturnType<typeof setUp>["stub"]) => stub.tables["recipes"] ?? [];

Deno.test(
  "the board's Chicken and rice saves 550 kcal, P 37 g, C 79 g and F 8.6 g a serving and builds the board's card",
  async () => {
    const { ctx, stub, store } = setUp();

    const result = await executeTool(ctx, "create_recipe", chickenAndRice);

    assertEquals(result.status, "ok");
    const [row] = recipesOf(stub);
    const id = String(row?.["id"]);
    assertObjectMatch(structuredOf(result), {
      card: {
        kind: "recipe_created",
        title: "Added recipe Chicken and rice, 4 servings",
        sub: "Per serving 550 kcal · P 37 g · C 79 g · F 8.6 g",
        rows: [],
        totalText: null,
        note: null,
        link: { label: "Open in recipe editor", target: { screen: "recipe_editor", recipeId: id } },
        undo: "available",
        undoneSub: "Archived Chicken and rice",
      },
    });
    assertObjectMatch(row ?? {}, {
      name: "Chicken and rice",
      servings: 4,
      yield_grams: null,
      instructions: chickenAndRice.steps,
      is_archived: false,
    });
    assertEquals(store.actions.length, 1);
    const [action] = store.actions;
    assertEquals(action?.tool, "create_recipe");
    assertEquals(action?.targetTable, "recipes");
    assertEquals(action?.targetId, id);
    assertEquals(action?.targetIds, null);
    assertEquals(action?.targetUpdatedAt, null);
  },
);

Deno.test("the ingredients are built from the foods as the database holds them", async () => {
  const { ctx, stub } = setUp();

  await executeTool(ctx, "create_recipe", chickenAndRice);

  const ingredients = (recipesOf(stub)[0]?.["recipe_ingredients"] ?? []) as Record<
    string,
    unknown
  >[];
  assertEquals(
    ingredients.map((ingredient) => [
      ingredient["position"],
      ingredient["food_id"],
      ingredient["unit"],
      ingredient["quantity"],
      ingredient["portion_id"],
      ingredient["resolved_grams"],
    ]),
    [
      [0, chickenId, "g", 500, null, 500],
      [1, riceId, "g", 400, null, 400],
      [2, oliveOilId, "portion", 2, tablespoonId, 27],
    ],
  );
  assertObjectMatch(ingredients[0]?.["snapshot"] as object, { name: "Chicken breast, raw" });
});

Deno.test("the numbers the model reads are the saved ones, with the recipe's id", async () => {
  const { ctx, stub } = setUp();

  const result = await executeTool(ctx, "create_recipe", chickenAndRice);

  const payload = payloadOf(result) as { created: Record<string, unknown> };
  assertEquals(payload.created["id"], recipesOf(stub)[0]?.["id"]);
  assertObjectMatch(payload.created, { name: "Chicken and rice", servings: 4 });
  assertObjectMatch(payload.created["per_serving"] as object, { kcal: 550.25, fat_g: 8.6 });
});

Deno.test("an amount in millilitres is worked out with the food's own density", async () => {
  const { ctx, stub } = setUp();

  const result = await executeTool(ctx, "create_recipe", {
    ...chickenAndRice,
    ingredients: [{ food_id: oliveOilId, unit: "ml", amount: 30, portion_id: null }],
  });

  assertEquals(result.status, "ok");
  const [ingredient] = (recipesOf(stub)[0]?.["recipe_ingredients"] ?? []) as Record<
    string,
    unknown
  >[];
  assertObjectMatch(ingredient ?? {}, { unit: "ml", quantity: 30, resolved_grams: 27 });
});

Deno.test("a portion of another food is invalid_input and nothing is written", async () => {
  const { ctx, stub, store } = setUp();

  const result = await executeTool(ctx, "create_recipe", {
    ...chickenAndRice,
    ingredients: [
      chickenAndRiceIngredients[0],
      { food_id: oliveOilId, unit: "portion", amount: 2, portion_id: largeEggId },
    ],
  });

  assertEquals(payloadOf(result), { error: "invalid_input", fields: ["ingredients.1.portion_id"] });
  assertEquals(recipesOf(stub), []);
  assertEquals(store.actions.length, 0);
});

Deno.test(
  "a food that is not there, or was deleted, is not_found and names the ingredient",
  async () => {
    const { ctx, stub } = setUp();
    const unknownFood = "00000000-0000-4000-8000-0000000000ff";

    for (const [index, foodId] of [unknownFood, deletedFoodId].entries()) {
      const result = await executeTool(ctx, "create_recipe", {
        ...chickenAndRice,
        ingredients: [
          ...chickenAndRiceIngredients.slice(0, index + 1),
          { food_id: foodId, unit: "g", amount: 100, portion_id: null },
        ],
      });

      assertEquals(payloadOf(result), {
        error: "not_found",
        fields: [`ingredients.${index + 1}.food_id`],
      });
    }
    assertEquals(recipesOf(stub), []);
  },
);

Deno.test(
  "fields that do not belong to the unit, or are missing, are named by the executor",
  async () => {
    const { ctx } = setUp();
    const cases: [Record<string, unknown>, string][] = [
      [
        { food_id: chickenId, unit: "portion", amount: 2, portion_id: null },
        "ingredients.0.portion_id",
      ],
      [
        { food_id: chickenId, unit: "g", amount: 100, portion_id: tablespoonId },
        "ingredients.0.portion_id",
      ],
      [
        { food_id: chickenId, unit: "ml", amount: 100, portion_id: tablespoonId },
        "ingredients.0.portion_id",
      ],
      [
        { food_id: chickenId, unit: "portion", amount: 500, portion_id: tablespoonId },
        "ingredients.0.amount",
      ],
      [{ food_id: chickenId, unit: "cups", amount: 1, portion_id: null }, "ingredients.0.unit"],
      [{ food_id: chickenId, unit: "g", amount: 0, portion_id: null }, "ingredients.0.amount"],
    ];
    for (const [ingredient, field] of cases) {
      const result = await executeTool(ctx, "create_recipe", {
        ...chickenAndRice,
        ingredients: [ingredient],
      });

      assertEquals(result.status, "error");
      assertEquals(payloadOf(result), { error: "invalid_input", fields: [field] });
    }
  },
);

Deno.test("a recipe needs a name, servings, and 1 to 40 ingredients", async () => {
  const { ctx, stub } = setUp();
  const ingredient = chickenAndRiceIngredients[0];
  const cases: [Record<string, unknown>, string][] = [
    [{ name: "   " }, "name"],
    [{ name: "x".repeat(201) }, "name"],
    [{ servings: 0 }, "servings"],
    [{ servings: 1001 }, "servings"],
    [{ ingredients: [] }, "ingredients"],
    [{ ingredients: Array.from({ length: 41 }, () => ingredient) }, "ingredients"],
    [{ steps: Array.from({ length: 51 }, () => "Stir.") }, "steps"],
    [{ steps: ["x".repeat(1001)] }, "steps.0"],
  ];
  for (const [change, field] of cases) {
    const result = await executeTool(ctx, "create_recipe", { ...chickenAndRice, ...change });

    assertEquals(payloadOf(result), { error: "invalid_input", fields: [field] });
  }
  assertEquals(recipesOf(stub), []);
});

Deno.test("forty ingredients are saved", async () => {
  const { ctx, stub } = setUp();

  const result = await executeTool(ctx, "create_recipe", {
    ...chickenAndRice,
    ingredients: Array.from({ length: 40 }, () => chickenAndRiceIngredients[0]),
  });

  assertEquals(result.status, "ok");
  assertEquals(((recipesOf(stub)[0]?.["recipe_ingredients"] ?? []) as unknown[]).length, 40);
});

Deno.test("a javascript: source URL is invalid_input and nothing is written", async () => {
  const { ctx, stub } = setUp();

  for (const source_url of [
    "javascript:alert(1)",
    "javascript://example.com/%0Aalert(1)",
    "ftp://example.com/recipe",
    "data:text/html,hello",
    "https://",
    "not a url",
  ]) {
    const result = await executeTool(ctx, "create_recipe", { ...chickenAndRice, source_url });

    assertEquals(payloadOf(result), { error: "invalid_input", fields: ["source_url"] });
  }
  assertEquals(recipesOf(stub), []);
});

Deno.test("an https source URL is saved on the recipe, and none leaves it null", async () => {
  const withLink = setUp();
  const without = setUp();

  await executeTool(withLink.ctx, "create_recipe", {
    ...chickenAndRice,
    source_url: "https://example.com/chicken-and-rice",
  });
  await executeTool(without.ctx, "create_recipe", chickenAndRice);

  assertEquals(recipesOf(withLink.stub)[0]?.["source_url"], "https://example.com/chicken-and-rice");
  assertEquals(recipesOf(without.stub)[0]?.["source_url"], null);
  assertFalse(
    without.stub.calls.some((call) => call.table === "recipes" && call.method === "update"),
  );
});

Deno.test(
  "the link is saved on the new recipe only, and no other recipe's link moves",
  async () => {
    const bystander = recipeRow({ source_url: "https://example.com/bystander" });
    const { ctx, stub } = recipeContext([createRecipeTool], { rows: { recipes: [bystander] } });

    const result = await executeTool(ctx, "create_recipe", {
      ...chickenAndRice,
      source_url: "https://example.com/chicken-and-rice",
    });

    assertEquals(result.status, "ok");
    assertEquals(
      Object.fromEntries(recipesOf(stub).map((row) => [row["name"], row["source_url"]])),
      {
        "Pasta bake": "https://example.com/bystander",
        "Chicken and rice": "https://example.com/chicken-and-rice",
      },
    );
  },
);

Deno.test("an amount in millilitres of a food with no density is invalid_input", async () => {
  const { ctx, stub } = setUp();

  const result = await executeTool(ctx, "create_recipe", {
    ...chickenAndRice,
    ingredients: [
      chickenAndRiceIngredients[1],
      { food_id: chickenId, unit: "ml", amount: 100, portion_id: null },
    ],
  });

  assertEquals(payloadOf(result), { error: "invalid_input", fields: ["ingredients.1.amount"] });
  assertEquals(recipesOf(stub), []);
});

Deno.test("the link is saved by the same write as the recipe, with no second write", async () => {
  const { ctx, stub, store, reported } = setUp();

  const result = await executeTool(ctx, "create_recipe", {
    ...chickenAndRice,
    source_url: "https://example.com/chicken-and-rice",
  });

  assertEquals(result.status, "ok");
  assertEquals(recipesOf(stub)[0]?.["source_url"], "https://example.com/chicken-and-rice");
  assertFalse(stub.calls.some((call) => call.table === "recipes" && call.method === "update"));
  assertFalse("source_url_saved" in (payloadOf(result) as object));
  assertEquals(store.actions.length, 1);
  assertEquals(reported, []);
});

Deno.test("Undo archives the recipe, and a second Undo is already_undone", async () => {
  const { ctx, stub } = setUp();
  const created = await executeTool(ctx, "create_recipe", chickenAndRice);
  assert(created.status === "ok" && created.actionId !== null);

  const first = await undoAction(ctx, created.actionId);
  const second = await undoAction(ctx, created.actionId);

  assertEquals(first, { status: "undone", actionId: created.actionId });
  assertEquals(second, { status: "error", code: "already_undone" });
  assertEquals(recipesOf(stub)[0]?.["is_archived"], true);
  assertEquals(recipesOf(stub).length, 1);
});

Deno.test("Undo is unavailable once the person archived the recipe", async () => {
  const { ctx, stub } = setUp();
  const created = await executeTool(ctx, "create_recipe", chickenAndRice);
  assert(created.status === "ok" && created.actionId !== null);
  Object.assign(recipesOf(stub)[0] ?? {}, { is_archived: true });

  const result = await undoAction(ctx, created.actionId);

  assertEquals(result, { status: "error", code: "undo_unavailable" });
});

Deno.test("Undo is unavailable once the recipe is gone, and touches no other recipe", async () => {
  const bystander = recipeRow();
  const { ctx, stub } = recipeContext([createRecipeTool], { rows: { recipes: [bystander] } });
  const created = await executeTool(ctx, "create_recipe", chickenAndRice);
  assert(created.status === "ok" && created.actionId !== null);
  stub.tables["recipes"] = [bystander];

  const result = await undoAction(ctx, created.actionId);

  assertEquals(result, { status: "error", code: "undo_unavailable" });
  assertEquals(recipesOf(stub), [bystander]);
  assertEquals(recipesOf(stub)[0]?.["is_archived"], false);
});

Deno.test("no health value reaches the console or the reported errors", async () => {
  const spy = spyOnConsole();
  const { ctx, reported } = setUp();
  try {
    await executeTool(ctx, "create_recipe", {
      ...chickenAndRice,
      source_url: "https://example.com/chicken-and-rice",
    });
  } finally {
    spy.restore();
  }

  assertEquals(spy.lines, []);
  assertEquals(reported, []);
});
