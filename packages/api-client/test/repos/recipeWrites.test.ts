import { buildRecipeIngredient, computeRecipe } from "@keylow/core/recipes";
import { buildChickenAndRiceRecipe } from "@keylow/core/testing";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createRecipe,
  duplicateRecipe,
  setRecipeArchived,
  updateRecipe,
} from "../../src/repos/recipeWrites";
import { createTestClient } from "../createTestClient";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
import { RECIPE_ID, recipeDetailRow, recipeSummaryRow } from "../support/recipes";

import type { RecipeSave } from "../../src/repos/recipeWrites";

const server = setupServer();

const SAVE_URL = `${REST_URL}/rpc/save_recipe`;
const COPY_ID = "66666666-6666-4666-8666-666666666666";

/** Every request the server saw, so a test can say what was and was not asked of the database. */
let requests: { method: string; path: string; body: unknown }[] = [];

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  requests = [];
  server.events.on("request:start", async ({ request }) => {
    const text = await request.clone().text();
    requests.push({
      method: request.method,
      path: new URL(request.url).pathname.replace("/rest/v1", ""),
      body: text === "" ? undefined : JSON.parse(text),
    });
  });
});
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
});
afterAll(() => {
  server.close();
});

const chickenAndRice = buildChickenAndRiceRecipe();
const chickenIngredient = buildRecipeIngredient(chickenAndRice.foods.chicken, {
  quantity: 500,
  unit: "g",
});

const recipeToSave = (overrides: Partial<RecipeSave> = {}): RecipeSave => ({
  name: "Chicken and rice",
  servings: 4,
  yieldGrams: null,
  ingredients: chickenAndRice.ingredients,
  steps: ["Poach the chicken.", "Cook the rice.", "Serve."],
  ...overrides,
});

/** Answers the save with `id` and the read back of the recipe with `row`. */
const answerSave = (id: string = RECIPE_ID, row: unknown = recipeDetailRow({ id })) => {
  server.use(
    http.post(SAVE_URL, () => HttpResponse.json(id)),
    http.get(`${REST_URL}/recipes`, ({ request }) => postgrestRows(request, [row])),
  );
};

const writes = () => requests.filter(({ method }) => method !== "GET");

const saveRecipeBodySchema = z.object({
  p_recipe_id: z.string().nullable(),
  p_recipe: z.record(z.string(), z.unknown()),
  p_ingredients: z.array(z.record(z.string(), z.unknown())),
});

const savedRecipe = () => {
  const [save] = requests.filter(({ path }) => path === "/rpc/save_recipe");
  if (!save) {
    throw new Error("No save_recipe request was made");
  }
  return saveRecipeBodySchema.parse(save.body);
};

describe("createRecipe", () => {
  it("should save the recipe, its ingredients, its steps and its totals in a single request", async () => {
    answerSave();

    await createRecipe(createTestClient(), recipeToSave());

    expect(writes().map(({ method, path }) => `${method} ${path}`)).toEqual([
      "POST /rpc/save_recipe",
    ]);
  });

  it("should send a null recipe id, because the database chooses the id of a new recipe", async () => {
    answerSave();

    await createRecipe(createTestClient(), recipeToSave());

    expect(savedRecipe().p_recipe_id).toBeNull();
  });

  it("should send the name, servings, yield and steps of the recipe", async () => {
    answerSave();

    await createRecipe(createTestClient(), recipeToSave({ yieldGrams: 1100 }));

    expect(savedRecipe().p_recipe).toMatchObject({
      name: "Chicken and rice",
      servings: 4,
      yield_grams: 1100,
      instructions: ["Poach the chicken.", "Cook the rice.", "Serve."],
    });
  });

  it("should send the ingredient rows built by core in list order, without a position", async () => {
    answerSave();

    await createRecipe(createTestClient(), recipeToSave());

    expect(savedRecipe().p_ingredients).toEqual(
      JSON.parse(JSON.stringify(chickenAndRice.ingredients)),
    );
  });

  it("should compute the totals itself from the ingredients it is given", async () => {
    answerSave();

    await createRecipe(createTestClient(), recipeToSave({ yieldGrams: 1100 }));

    expect(savedRecipe().p_recipe.computed).toEqual(
      JSON.parse(
        JSON.stringify(
          computeRecipe({
            servings: 4,
            yieldGrams: 1100,
            ingredients: chickenAndRice.ingredients,
          }),
        ),
      ),
    );
  });

  it("should ignore a computed cache that a caller slips into the input", async () => {
    answerSave();
    const staleCache = { total: { kcal: 1 }, totalGrams: 1 };

    await createRecipe(createTestClient(), Object.assign(recipeToSave(), { computed: staleCache }));

    expect(savedRecipe().p_recipe.computed).not.toEqual(staleCache);
    expect(savedRecipe().p_recipe.computed).toMatchObject({ totalGrams: 720 });
  });

  it("should trim the steps and drop the blank ones, keeping the order", async () => {
    answerSave();

    await createRecipe(
      createTestClient(),
      recipeToSave({ steps: ["  Poach the chicken.  ", "   ", "Serve.", ""] }),
    );

    expect(savedRecipe().p_recipe.instructions).toEqual(["Poach the chicken.", "Serve."]);
  });

  it("should accept a recipe with no ingredients and no steps, as the database does", async () => {
    answerSave();

    await createRecipe(createTestClient(), recipeToSave({ ingredients: [], steps: [] }));

    expect(savedRecipe().p_ingredients).toEqual([]);
    expect(savedRecipe().p_recipe.instructions).toEqual([]);
  });

  it("should resolve to the recipe as stored, read back after the save", async () => {
    answerSave(RECIPE_ID, recipeDetailRow({ name: "Stored name" }));

    const stored = await createRecipe(createTestClient(), recipeToSave());

    expect(stored).toMatchObject({ id: RECIPE_ID, name: "Stored name" });
    expect(stored.ingredients).toHaveLength(3);
    expect(requests.at(-1)).toMatchObject({ method: "GET", path: "/recipes" });
  });

  it("should throw an error naming the action and the code only, with the code as the cause", async () => {
    server.use(
      http.post(SAVE_URL, () =>
        postgrestError(400, "22023", "the recipe name must not be blank", {
          details: "Failing row contains (Secret stew)",
        }),
      ),
    );

    const failure = createRecipe(createTestClient(), recipeToSave({ name: "Secret stew" }));

    await expect(failure).rejects.toThrow(new Error("Could not save the recipe (22023)"));
    await expect(failure).rejects.toHaveProperty("cause", { code: "22023" });
  });

  it("should not read the recipe back when the save failed", async () => {
    server.use(http.post(SAVE_URL, () => postgrestError(500, "XX000", "boom")));

    await expect(createRecipe(createTestClient(), recipeToSave())).rejects.toThrow();

    expect(requests.map(({ method }) => method)).toEqual(["POST"]);
  });

  it("should throw when the saved recipe cannot be read back", async () => {
    server.use(
      http.post(SAVE_URL, () => HttpResponse.json(RECIPE_ID)),
      http.get(`${REST_URL}/recipes`, ({ request }) => postgrestRows(request, [])),
    );

    await expect(createRecipe(createTestClient(), recipeToSave())).rejects.toThrow(
      new Error("Could not load the recipe after saving it"),
    );
  });
});

describe("updateRecipe", () => {
  it("should save the id of the recipe being replaced, in a single request", async () => {
    answerSave();

    await updateRecipe(createTestClient(), { ...recipeToSave(), id: RECIPE_ID });

    expect(savedRecipe().p_recipe_id).toBe(RECIPE_ID);
    expect(writes()).toHaveLength(1);
  });

  it("should send the new ingredients, steps and totals", async () => {
    answerSave();
    const oilOnly = [buildRecipeIngredient(chickenAndRice.foods.oil, { quantity: 20, unit: "g" })];

    await updateRecipe(createTestClient(), {
      ...recipeToSave({ ingredients: oilOnly, steps: ["Heat the oil."] }),
      id: RECIPE_ID,
    });

    expect(savedRecipe().p_ingredients).toHaveLength(1);
    expect(savedRecipe().p_recipe.instructions).toEqual(["Heat the oil."]);
    expect(savedRecipe().p_recipe.computed).toMatchObject({ totalGrams: 20 });
  });

  it("should not send the archived flag, which a save neither reads nor changes", async () => {
    answerSave();

    await updateRecipe(createTestClient(), { ...recipeToSave(), id: RECIPE_ID });

    expect(savedRecipe().p_recipe).not.toHaveProperty("is_archived");
  });

  it("should name the action and the code when the recipe is not the caller's", async () => {
    server.use(
      http.post(SAVE_URL, () =>
        postgrestError(404, "P0002", "the recipe does not exist or is not yours"),
      ),
    );

    await expect(
      updateRecipe(createTestClient(), { ...recipeToSave(), id: RECIPE_ID }),
    ).rejects.toThrow(new Error("Could not save the recipe (P0002)"));
  });
});

describe("what a save checks before it asks the database anything", () => {
  const badSaves: [string, RecipeSave][] = [
    ["a blank name", recipeToSave({ name: "   " })],
    ["a name over 200 characters", recipeToSave({ name: "a".repeat(201) })],
    ["servings of 0", recipeToSave({ servings: 0 })],
    ["servings over 1000", recipeToSave({ servings: 1001 })],
    ["servings that are not a number", recipeToSave({ servings: Number.NaN })],
    ["a yield of 0", recipeToSave({ yieldGrams: 0 })],
    ["a yield over 100000", recipeToSave({ yieldGrams: 100_001 })],
    ["more than 50 steps", recipeToSave({ steps: Array.from({ length: 51 }, () => "Stir.") })],
    ["a step over 1000 characters", recipeToSave({ steps: ["a".repeat(1001)] })],
    [
      "more than 100 ingredients",
      recipeToSave({
        ingredients: Array.from({ length: 101 }, () => chickenIngredient),
      }),
    ],
    [
      "an ingredient with a quantity of 0, which the builder allows and the schema refuses",
      recipeToSave({
        ingredients: [buildRecipeIngredient(chickenAndRice.foods.oil, { quantity: 0, unit: "g" })],
      }),
    ],
    [
      "an ingredient with a negative quantity",
      recipeToSave({
        ingredients: [{ ...chickenIngredient, quantity: -5, resolved_grams: -5 }],
      }),
    ],
    [
      "an ingredient whose columns disagree with its snapshot",
      recipeToSave({ ingredients: [{ ...chickenIngredient, quantity: 501 }] }),
    ],
  ];

  it.each(badSaves)(
    "should throw a RangeError and make no request for %s",
    async (_label, save) => {
      await expect(createRecipe(createTestClient(), save)).rejects.toBeInstanceOf(RangeError);
      await expect(
        updateRecipe(createTestClient(), { ...save, id: RECIPE_ID }),
      ).rejects.toBeInstanceOf(RangeError);

      expect(requests).toEqual([]);
    },
  );

  it("should name the field that is wrong and never the value in it", async () => {
    const failure = createRecipe(
      createTestClient(),
      recipeToSave({ name: "  ", steps: ["Secret step ".repeat(100)] }),
    );

    await expect(failure).rejects.toThrow(/name/);
    await expect(failure).rejects.toThrow(/steps/);
    await expect(failure).rejects.not.toThrow(/Secret/);
  });

  it("should not quote the quantity of a bad ingredient", async () => {
    const failure = createRecipe(
      createTestClient(),
      recipeToSave({
        ingredients: [{ ...chickenIngredient, quantity: -987.654, resolved_grams: -987.654 }],
      }),
    );

    await expect(failure).rejects.toThrow(/ingredients/);
    await expect(failure).rejects.not.toThrow(/987/);
  });
});

describe("setRecipeArchived", () => {
  const answerUpdate = (row: unknown = recipeSummaryRow({ is_archived: true })) => {
    const seen: { url?: URL; body?: unknown } = {};
    server.use(
      http.patch(`${REST_URL}/recipes`, async ({ request }) => {
        seen.url = new URL(request.url);
        seen.body = await request.clone().json();
        return postgrestRows(request, [row]);
      }),
    );
    return seen;
  };

  it("should set the archived flag of the recipe with a plain column update and nothing else", async () => {
    const seen = answerUpdate();

    await setRecipeArchived(createTestClient(), RECIPE_ID, true);

    expect(seen.url?.searchParams.get("id")).toBe(`eq.${RECIPE_ID}`);
    expect(seen.body).toEqual({ is_archived: true });
    expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual(["PATCH /recipes"]);
  });

  it("should clear the flag to restore the recipe, with the same call", async () => {
    const seen = answerUpdate(recipeSummaryRow({ is_archived: false }));

    const restored = await setRecipeArchived(createTestClient(), RECIPE_ID, false);

    expect(seen.body).toEqual({ is_archived: false });
    expect(restored.is_archived).toBe(false);
  });

  it("should resolve to the recipe as stored, with its totals", async () => {
    answerUpdate();

    const archived = await setRecipeArchived(createTestClient(), RECIPE_ID, true);

    expect(archived).toMatchObject({ id: RECIPE_ID, name: "Chicken and rice", is_archived: true });
    expect(archived.computed.totalGrams).toBe(720);
  });

  it("should name the action and the code when the update fails", async () => {
    server.use(
      http.patch(`${REST_URL}/recipes`, () => postgrestError(500, "XX000", "Secret stew")),
    );

    const failure = setRecipeArchived(createTestClient(), RECIPE_ID, true);

    await expect(failure).rejects.toThrow(new Error("Could not archive the recipe (XX000)"));
    await expect(failure).rejects.toHaveProperty("cause", { code: "XX000" });
  });

  it("should name restoring and not archiving when the flag is cleared", async () => {
    server.use(http.patch(`${REST_URL}/recipes`, () => postgrestError(500, "XX000", "boom")));

    await expect(setRecipeArchived(createTestClient(), RECIPE_ID, false)).rejects.toThrow(
      new Error("Could not restore the recipe (XX000)"),
    );
  });

  it("should fail with a code when no row was updated, as it is for a recipe that is not the caller's", async () => {
    server.use(http.patch(`${REST_URL}/recipes`, ({ request }) => postgrestRows(request, [])));

    await expect(setRecipeArchived(createTestClient(), RECIPE_ID, true)).rejects.toThrow(
      new Error("Could not archive the recipe (PGRST116)"),
    );
  });
});

describe("duplicateRecipe", () => {
  const original = recipeDetailRow({ instructions: ["Poach the chicken.", "Cook the rice."] });

  const answerDuplicate = () => {
    server.use(
      http.get(`${REST_URL}/recipes`, ({ request }) => {
        const wantsCopy = new URL(request.url).searchParams.get("id") === `eq.${COPY_ID}`;
        return postgrestRows(request, [wantsCopy ? recipeDetailRow({ id: COPY_ID }) : original]);
      }),
      http.post(SAVE_URL, () => HttpResponse.json(COPY_ID)),
    );
  };

  it("should save a copy under the name the caller chose, with a null id so that it is new", async () => {
    answerDuplicate();

    await duplicateRecipe(createTestClient(), {
      recipeId: RECIPE_ID,
      name: "Chicken and rice (2)",
    });

    expect(savedRecipe().p_recipe_id).toBeNull();
    expect(savedRecipe().p_recipe.name).toBe("Chicken and rice (2)");
  });

  it("should carry the servings, yield, steps and the stored ingredient rows as they are", async () => {
    server.use(
      http.get(`${REST_URL}/recipes`, ({ request }) =>
        postgrestRows(request, [{ ...original, servings: 6, yield_grams: 1200 }]),
      ),
      http.post(SAVE_URL, () => HttpResponse.json(COPY_ID)),
    );

    await duplicateRecipe(createTestClient(), { recipeId: RECIPE_ID, name: "Copy" });

    expect(savedRecipe().p_recipe).toMatchObject({
      servings: 6,
      yield_grams: 1200,
      instructions: ["Poach the chicken.", "Cook the rice."],
    });
    expect(savedRecipe().p_ingredients).toEqual(
      JSON.parse(JSON.stringify(chickenAndRice.ingredients)),
    );
  });

  it("should write the copy in a single request and nothing else", async () => {
    answerDuplicate();

    await duplicateRecipe(createTestClient(), { recipeId: RECIPE_ID, name: "Copy" });

    expect(writes().map(({ method, path }) => `${method} ${path}`)).toEqual([
      "POST /rpc/save_recipe",
    ]);
  });

  it("should not send the archived flag, so that a copy of an archived recipe starts live", async () => {
    server.use(
      http.get(`${REST_URL}/recipes`, ({ request }) =>
        postgrestRows(request, [{ ...original, is_archived: true }]),
      ),
      http.post(SAVE_URL, () => HttpResponse.json(COPY_ID)),
    );

    await duplicateRecipe(createTestClient(), { recipeId: RECIPE_ID, name: "Copy" });

    expect(savedRecipe().p_recipe).not.toHaveProperty("is_archived");
  });

  it("should resolve to the copy as stored", async () => {
    answerDuplicate();

    const copy = await duplicateRecipe(createTestClient(), { recipeId: RECIPE_ID, name: "Copy" });

    expect(copy.id).toBe(COPY_ID);
  });

  it("should fail with the code of a recipe that is not the caller's, and write nothing, when there is none to copy", async () => {
    server.use(http.get(`${REST_URL}/recipes`, ({ request }) => postgrestRows(request, [])));

    const failure = duplicateRecipe(createTestClient(), { recipeId: RECIPE_ID, name: "Copy" });

    await expect(failure).rejects.toThrow(new Error("Could not duplicate the recipe (P0002)"));
    expect(writes()).toEqual([]);
  });

  it("should name the action and the code when reading the recipe to copy fails", async () => {
    server.use(http.get(`${REST_URL}/recipes`, () => postgrestError(500, "XX000", "boom")));

    await expect(
      duplicateRecipe(createTestClient(), { recipeId: RECIPE_ID, name: "Copy" }),
    ).rejects.toThrow(new Error("Could not load the recipe (XX000)"));
  });

  it("should check the new name before any request", async () => {
    await expect(
      duplicateRecipe(createTestClient(), { recipeId: RECIPE_ID, name: "  " }),
    ).rejects.toBeInstanceOf(RangeError);

    expect(requests).toEqual([]);
  });
});

describe("what an error from a recipe write holds", () => {
  const SECRETS = ["Secret stew", "Secret lentils", "Secret step"];
  const secretMessage = `Failing row contains (${SECRETS.join(", ")})`;

  const failures: [string, () => Promise<unknown>][] = [
    [
      "a create",
      () =>
        createRecipe(
          createTestClient(),
          recipeToSave({ name: "Secret stew", steps: ["Secret step"] }),
        ),
    ],
    [
      "an update",
      () =>
        updateRecipe(createTestClient(), {
          ...recipeToSave({ name: "Secret stew", steps: ["Secret step"] }),
          id: RECIPE_ID,
        }),
    ],
    ["an archive", () => setRecipeArchived(createTestClient(), RECIPE_ID, true)],
    ["a restore", () => setRecipeArchived(createTestClient(), RECIPE_ID, false)],
    [
      "a duplicate whose read fails",
      () => duplicateRecipe(createTestClient(), { recipeId: RECIPE_ID, name: "Secret stew" }),
    ],
    [
      "a duplicate whose save fails",
      () => duplicateRecipe(createTestClient(), { recipeId: RECIPE_ID, name: "Secret stew" }),
    ],
  ];

  it.each(failures)(
    "should hold no name, ingredient or step when %s is refused by the database",
    async (label, run) => {
      const refusal = () => postgrestError(400, "23514", secretMessage, { details: secretMessage });
      server.use(
        http.post(SAVE_URL, refusal),
        http.patch(`${REST_URL}/recipes`, refusal),
        http.get(`${REST_URL}/recipes`, ({ request }) =>
          label === "a duplicate whose save fails"
            ? postgrestRows(request, [recipeDetailRow()])
            : refusal(),
        ),
      );

      const failure = await run().catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(Error);
      const everything = JSON.stringify([
        failure instanceof Error ? failure.message : "",
        failure instanceof Error ? failure.cause : "",
        failure instanceof Error ? failure.stack : "",
      ]);
      for (const secret of SECRETS) {
        expect(everything).not.toContain(secret);
      }
      expect(failure).toHaveProperty("message", expect.stringMatching(/\(23514\)$/));
    },
  );

  it("should hold no value of the recipe when the stored row it reads back does not parse", async () => {
    server.use(
      http.post(SAVE_URL, () => HttpResponse.json(RECIPE_ID)),
      http.get(`${REST_URL}/recipes`, ({ request }) =>
        postgrestRows(request, [
          { ...recipeDetailRow({ name: "Secret stew" }), servings: "Secret" },
        ]),
      ),
    );

    const failure = createRecipe(createTestClient(), recipeToSave());

    await expect(failure).rejects.toThrow(/servings/);
    await expect(failure).rejects.not.toThrow(/Secret/);
  });
});
