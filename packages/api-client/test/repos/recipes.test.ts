import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getRecipe, listRecipes, searchRecipes } from "../../src/repos/recipes";
import { createTestClient } from "../createTestClient";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
import { RECIPE_ID, recipeComputed, recipeDetailRow, recipeSummaryRow } from "../support/recipes";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

/** Answers the recipes table with `rows` and records the URL of the one request it saw. */
const answerRecipes = (rows: readonly unknown[]) => {
  const seen: { url?: URL } = {};
  server.use(
    http.get(`${REST_URL}/recipes`, ({ request }) => {
      seen.url = new URL(request.url);
      return postgrestRows(request, rows);
    }),
  );
  return seen;
};

describe("listRecipes", () => {
  it("should select only the lean library columns", async () => {
    const seen = answerRecipes([]);

    await listRecipes(createTestClient());

    expect(seen.url?.searchParams.get("select")).toBe(
      "id,name,servings,yield_grams,is_archived,computed",
    );
  });

  it("should list live recipes only by default", async () => {
    const seen = answerRecipes([]);

    await listRecipes(createTestClient());

    expect(seen.url?.searchParams.get("is_archived")).toBe("eq.false");
  });

  it("should not filter on the archived flag when archived recipes are asked for", async () => {
    const seen = answerRecipes([]);

    await listRecipes(createTestClient(), { archived: true });

    expect(seen.url?.searchParams.has("is_archived")).toBe(false);
  });

  it("should order the library by name, then id", async () => {
    const seen = answerRecipes([]);

    await listRecipes(createTestClient());

    expect(seen.url?.searchParams.get("order")).toBe("name.asc,id.asc");
  });

  it("should return the recipes as the database listed them, with their computed cache", async () => {
    answerRecipes([
      recipeSummaryRow({ name: "Chicken and rice" }),
      recipeSummaryRow({ id: "55555555-5555-4555-8555-555555555555", name: "Dal" }),
    ]);

    const recipes = await listRecipes(createTestClient());

    expect(recipes.map((recipe) => recipe.name)).toEqual(["Chicken and rice", "Dal"]);
    expect(recipes[0]).toEqual({
      id: RECIPE_ID,
      name: "Chicken and rice",
      servings: 4,
      yield_grams: null,
      is_archived: false,
      computed: recipeComputed,
    });
  });

  it("should throw an error naming the action and the code only", async () => {
    server.use(
      http.get(`${REST_URL}/recipes`, () => postgrestError(500, "XX000", "database unavailable")),
    );

    const failure = listRecipes(createTestClient());

    await expect(failure).rejects.toThrow(new Error("Could not load your recipes (XX000)"));
    await expect(failure).rejects.toHaveProperty("cause", { code: "XX000" });
  });

  it("should report the row id and the failing field path of a row that does not parse, never its values", async () => {
    answerRecipes([{ ...recipeSummaryRow({ name: "Secret stew" }), servings: "Secret servings" }]);

    const failure = listRecipes(createTestClient());

    await expect(failure).rejects.toThrow(
      `Could not load your recipes: row ${RECIPE_ID} has an unexpected shape at servings`,
    );
    await expect(failure).rejects.not.toThrow(/Secret/);
  });
});

describe("getRecipe", () => {
  it("should select the recipe with its ingredients embedded, in position order", async () => {
    const seen = answerRecipes([recipeDetailRow()]);

    await getRecipe(createTestClient(), RECIPE_ID);

    const select = seen.url?.searchParams.get("select") ?? "";
    expect(select).toContain("instructions");
    expect(select).toContain(
      "recipe_ingredients(position,food_id,quantity,unit,portion_id,resolved_grams,snapshot)",
    );
    expect(seen.url?.searchParams.get("recipe_ingredients.order")).toBe("position.asc");
    expect(seen.url?.searchParams.get("id")).toBe(`eq.${RECIPE_ID}`);
  });

  it("should return the recipe with its ingredients and its steps in order", async () => {
    answerRecipes([recipeDetailRow()]);

    const recipe = await getRecipe(createTestClient(), RECIPE_ID);

    expect(recipe).toMatchObject({
      id: RECIPE_ID,
      name: "Chicken and rice",
      servings: 4,
      yield_grams: null,
      is_archived: false,
      instructions: ["Poach the chicken.", "Cook the rice.", "Serve."],
      computed: recipeComputed,
    });
    expect(recipe?.ingredients.map((ingredient) => ingredient.position)).toEqual([0, 1, 2]);
    expect(recipe?.ingredients.map((ingredient) => ingredient.snapshot.name)).toEqual([
      "Chicken breast",
      "Dry rice",
      "Olive oil",
    ]);
  });

  it("should return a recipe with no ingredients and no steps", async () => {
    answerRecipes([{ ...recipeDetailRow({ instructions: [] }), recipe_ingredients: [] }]);

    const recipe = await getRecipe(createTestClient(), RECIPE_ID);

    expect(recipe).toMatchObject({ instructions: [], ingredients: [] });
  });

  it("should return null when the recipe is not visible to the caller", async () => {
    answerRecipes([]);

    expect(await getRecipe(createTestClient(), RECIPE_ID)).toBeNull();
  });

  it("should throw an error naming the action and the code only", async () => {
    server.use(
      http.get(`${REST_URL}/recipes`, () =>
        postgrestError(400, "22P02", 'invalid input syntax for type uuid: "Secret stew"'),
      ),
    );

    const failure = getRecipe(createTestClient(), "Secret stew");

    await expect(failure).rejects.toThrow(new Error("Could not load the recipe (22P02)"));
    await expect(failure).rejects.toHaveProperty("cause", { code: "22P02" });
  });

  it("should report the row id and the failing field paths of a recipe that does not parse, never its values", async () => {
    const row = recipeDetailRow({ name: "Secret stew" });
    answerRecipes([
      {
        ...row,
        instructions: ["Secret step", 7],
        recipe_ingredients: [{ ...row.recipe_ingredients[0], quantity: "Secret amount" }],
      },
    ]);

    const failure = getRecipe(createTestClient(), RECIPE_ID);

    await expect(failure).rejects.toThrow(
      `Could not load the recipe: row ${RECIPE_ID} has an unexpected shape at instructions.1, recipe_ingredients.0.quantity`,
    );
    await expect(failure).rejects.not.toThrow(/Secret/);
  });
});

describe("searchRecipes", () => {
  it("should match the trimmed query anywhere in the name, ignoring case", async () => {
    const seen = answerRecipes([]);

    await searchRecipes(createTestClient(), "  Stew ");

    expect(seen.url?.searchParams.get("name")).toBe("ilike.%Stew%");
  });

  it.each([
    ["a percent sign", "50%", "ilike.%50\\%%"],
    ["an underscore", "oat_cake", "ilike.%oat\\_cake%"],
    ["a backslash", "a\\b", "ilike.%a\\\\b%"],
    ["all three", "%_\\", "ilike.%\\%\\_\\\\%"],
  ])("should escape %s so it matches literally", async (_label, query, expected) => {
    const seen = answerRecipes([]);

    await searchRecipes(createTestClient(), query);

    expect(seen.url?.searchParams.get("name")).toBe(expected);
  });

  it("should never send an asterisk, which PostgREST turns into the any-length wildcard", async () => {
    const seen = answerRecipes([]);

    await searchRecipes(createTestClient(), "5*3");

    // PostgREST reads every * in an ilike value as %, and offers no way to escape it. A single-character
    // wildcard in its place keeps the star from standing for any number of characters.
    expect(seen.url?.searchParams.get("name")).toBe("ilike.%5_3%");
  });

  it("should search live recipes only by default", async () => {
    const seen = answerRecipes([]);

    await searchRecipes(createTestClient(), "stew");

    expect(seen.url?.searchParams.get("is_archived")).toBe("eq.false");
  });

  it("should not filter on the archived flag when archived recipes are asked for", async () => {
    const seen = answerRecipes([]);

    await searchRecipes(createTestClient(), "stew", { archived: true });

    expect(seen.url?.searchParams.has("is_archived")).toBe(false);
  });

  it("should select the lean library columns and order by name, then id", async () => {
    const seen = answerRecipes([]);

    await searchRecipes(createTestClient(), "stew");

    expect(seen.url?.searchParams.get("select")).toBe(
      "id,name,servings,yield_grams,is_archived,computed",
    );
    expect(seen.url?.searchParams.get("order")).toBe("name.asc,id.asc");
  });

  it("should ask for 25 recipes unless told otherwise, and keep a limit between 1 and 50", async () => {
    const limits: (string | null)[] = [];
    server.use(
      http.get(`${REST_URL}/recipes`, ({ request }) => {
        limits.push(new URL(request.url).searchParams.get("limit"));
        return postgrestRows(request, []);
      }),
    );
    const client = createTestClient();

    await searchRecipes(client, "stew");
    await searchRecipes(client, "stew", { limit: 10 });
    await searchRecipes(client, "stew", { limit: 500 });
    await searchRecipes(client, "stew", { limit: 0 });

    expect(limits).toEqual(["25", "10", "50", "1"]);
  });

  it("should make no request for a query shorter than 2 characters once trimmed", async () => {
    const client = createTestClient();

    // onUnhandledFrame is "error", so a request here would fail the test.
    expect(await searchRecipes(client, " s ")).toEqual([]);
    expect(await searchRecipes(client, "")).toEqual([]);
  });

  it("should return the matching recipes in the database's order", async () => {
    answerRecipes([
      recipeSummaryRow({ name: "Beef stew" }),
      recipeSummaryRow({ id: "55555555-5555-4555-8555-555555555555", name: "Lamb stew" }),
    ]);

    const recipes = await searchRecipes(createTestClient(), "stew");

    expect(recipes.map((recipe) => recipe.name)).toEqual(["Beef stew", "Lamb stew"]);
  });

  it("should throw an error naming the action and the code only", async () => {
    server.use(
      http.get(`${REST_URL}/recipes`, () => postgrestError(500, "XX000", "database unavailable")),
    );

    const failure = searchRecipes(createTestClient(), "stew");

    await expect(failure).rejects.toThrow(new Error("Could not search your recipes (XX000)"));
    await expect(failure).rejects.toHaveProperty("cause", { code: "XX000" });
  });
});

describe("what an error from a recipe read can carry", () => {
  // The database can quote a failing row in its message and details. A recipe is health data, so
  // none of these strings may reach a thrown error, whatever the database said.
  const quoted = ["Secret stew", "Secret chicken", "Secret step text"];

  const databaseErrorQuotingTheRecipe = () =>
    HttpResponse.json(
      {
        code: "23514",
        message: `new row for relation "recipes" violates check constraint: ${quoted[0]}`,
        details: `Failing row contains (${quoted.join(", ")}).`,
        hint: quoted[2],
      },
      { status: 400 },
    );

  it.each([
    ["listRecipes", (client: ReturnType<typeof createTestClient>) => listRecipes(client)],
    ["getRecipe", (client: ReturnType<typeof createTestClient>) => getRecipe(client, RECIPE_ID)],
    [
      "searchRecipes",
      (client: ReturnType<typeof createTestClient>) => searchRecipes(client, quoted[0] ?? ""),
    ],
  ])("should keep the quoted recipe out of the error %s throws", async (_name, read) => {
    server.use(http.get(`${REST_URL}/recipes`, databaseErrorQuotingTheRecipe));

    const error: unknown = await read(createTestClient()).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) {
      return;
    }
    const everythingTheErrorHolds = JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    });
    for (const text of quoted) {
      expect(everythingTheErrorHolds).not.toContain(text);
    }
    expect(error.cause).toEqual({ code: "23514" });
  });
});
