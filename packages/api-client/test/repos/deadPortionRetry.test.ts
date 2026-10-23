import { entryQuantityChange } from "@keylow/core/diary";
import { buildRecipeIngredient } from "@keylow/core/recipes";
import { buildFood, buildFoodPortion } from "@keylow/core/testing";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { logFood, updateLogEntry } from "../../src/repos/diaryWrites";
import { createRecipe } from "../../src/repos/recipeWrites";
import { createTestClient } from "../createTestClient";
import { FOOD_ID, foodEntryRow } from "../support/diary";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
import { RECIPE_ID, recipeDetailRow } from "../support/recipes";

// A refresh of a branded food deletes its portions and inserts new ones, so a picker that was opened
// before it can send an id that no longer exists. These tests say what the writes do then. Nothing here
// puts a food, a label or an amount in an assertion about an error.

const ENTRIES_URL = `${REST_URL}/food_log_entries`;
const SAVE_URL = `${REST_URL}/rpc/save_recipe`;
const PORTIONS_URL = `${REST_URL}/food_portions`;

const DEAD_PORTION_ID = "99999999-9999-4999-8999-999999999999";
const LIVE_PORTION_ID = "88888888-8888-4888-8888-888888888888";

const entryForeignKey = (column: string) =>
  `insert or update on table "food_log_entries" violates foreign key constraint "food_log_entries_${column}_fkey"`;
const ingredientForeignKey = (column: string) =>
  `insert or update on table "recipe_ingredients" violates foreign key constraint "recipe_ingredients_${column}_fkey"`;
const ROW_LEVEL_SECURITY =
  'new row violates row-level security policy for table "food_log_entries"';

const bodySchema = z.record(z.string(), z.unknown());

const server = setupServer();

let bodies: unknown[] = [];

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  bodies = [];
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

/** Answers the writes to the entries table one after the other, recording the body of each. */
function answerEntryWrites(method: "post" | "patch", answers: ((request: Request) => Response)[]) {
  let call = 0;
  const handler = async ({ request }: { request: Request }) => {
    bodies.push(bodySchema.parse(await request.clone().json()));
    const answer = answers[Math.min(call, answers.length - 1)];
    call += 1;
    if (answer === undefined) {
      throw new Error("No answer was given");
    }
    return answer(request);
  };
  server.use(
    method === "post" ? http.post(ENTRIES_URL, handler) : http.patch(ENTRIES_URL, handler),
  );
}

const refused = (code: string, message: string) => () =>
  postgrestError(code === "42501" ? 403 : 409, code, message);
const stored = (row: unknown) => (request: Request) => postgrestRows(request, [row], 201);

const portion = buildFoodPortion({
  id: DEAD_PORTION_ID,
  food_id: FOOD_ID,
  label: "1 can",
  grams: 330,
});
const food = buildFood({ id: FOOD_ID, name: "Cola", kcal: 42 });

const logInput = {
  food,
  quantity: 1,
  unit: "portion",
  portion,
  foodPortions: [portion],
  loggedAt: "2026-10-15T12:00:00.000Z",
  localDate: "2026-10-15",
} as const;

describe("logFood with a portion that no longer exists", () => {
  it.each([
    ["a foreign key violation naming portion_id", "23503", entryForeignKey("portion_id")],
    ["a row level security refusal", "42501", ROW_LEVEL_SECURITY],
  ])("should write the entry again with no portion after %s", async (_name, code, message) => {
    const row = foodEntryRow({ unit: "portion", portion_id: null });
    answerEntryWrites("post", [refused(code, message), stored(row)]);

    const entry = await logFood(createTestClient(), logInput);

    expect(entry).toEqual(row);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toMatchObject({ portion_id: DEAD_PORTION_ID });
    expect(bodies[1]).toMatchObject({ portion_id: null });
  });

  it("should keep the snapshot, the amount and the time in the second write", async () => {
    answerEntryWrites("post", [
      refused("23503", entryForeignKey("portion_id")),
      stored(foodEntryRow()),
    ]);

    await logFood(createTestClient(), logInput);

    const [first, second] = bodies;
    expect(second).toEqual({ ...bodySchema.parse(first), portion_id: null });
    expect(second).toMatchObject({
      quantity: 1,
      unit: "portion",
      snapshot: { portion: { label: "1 can", grams: 330 } },
    });
  });

  it("should write only twice, and throw, when the second write is refused too", async () => {
    answerEntryWrites("post", [refused("23503", entryForeignKey("portion_id"))]);

    const failure = await logFood(createTestClient(), logInput).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(bodies).toHaveLength(2);
  });

  it("should not write again after another foreign key violation", async () => {
    answerEntryWrites("post", [
      refused("23503", entryForeignKey("food_id")),
      stored(foodEntryRow()),
    ]);

    const failure = await logFood(createTestClient(), logInput).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(bodies).toHaveLength(1);
  });

  it("should not write again after an error that is neither of those", async () => {
    answerEntryWrites("post", [refused("23514", "check violation"), stored(foodEntryRow())]);

    const failure = await logFood(createTestClient(), logInput).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(bodies).toHaveLength(1);
  });

  it("should not write again for an entry that carries no portion", async () => {
    answerEntryWrites("post", [refused("42501", ROW_LEVEL_SECURITY), stored(foodEntryRow())]);

    const failure = await logFood(createTestClient(), {
      food,
      quantity: 50,
      unit: "g",
      loggedAt: "2026-10-15T12:00:00.000Z",
      localDate: "2026-10-15",
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(bodies).toHaveLength(1);
  });
});

describe("updateLogEntry with a portion that no longer exists", () => {
  const original = foodEntryRow();
  const change = {
    entry: original,
    amount: entryQuantityChange({ unit: "portion", quantity: 1, portion }),
  };

  it.each([
    ["a foreign key violation naming portion_id", "23503", entryForeignKey("portion_id")],
    ["a row level security refusal", "42501", ROW_LEVEL_SECURITY],
  ])(
    "should update the entry again with no portion, keeping the snapshot and the amount, after %s",
    async (_name, code, message) => {
      const row = foodEntryRow({ unit: "portion", quantity: 1, portion_id: null });
      answerEntryWrites("patch", [
        refused(code, message),
        (request) => postgrestRows(request, [row]),
      ]);

      const updated = await updateLogEntry(createTestClient(), change);

      expect(updated).toEqual(row);
      const [first, second] = bodies;
      expect(first).toMatchObject({ portion_id: DEAD_PORTION_ID });
      expect(second).toEqual({ ...bodySchema.parse(first), portion_id: null });
    },
  );

  it("should not update again after another foreign key violation", async () => {
    answerEntryWrites("patch", [refused("23503", entryForeignKey("food_id"))]);

    const failure = await updateLogEntry(createTestClient(), change).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(Error);
    expect(bodies).toHaveLength(1);
  });
});

describe("a recipe saved with a portion that no longer exists", () => {
  const liveSecondPortion = buildFoodPortion({
    id: LIVE_PORTION_ID,
    food_id: FOOD_ID,
    label: "1 tin",
    grams: 400,
  });
  const ingredients = [
    buildRecipeIngredient(food, { quantity: 1, unit: "portion", portion }),
    buildRecipeIngredient(food, { quantity: 1, unit: "portion", portion: liveSecondPortion }),
  ];
  const save = {
    name: "Cola float",
    servings: 2,
    yieldGrams: null,
    ingredients,
    steps: ["Pour."],
  };

  let savedIngredients: unknown[][] = [];
  let portionLookups: string[] = [];

  const answerSaves = (answers: (() => Response)[], livePortionIds: string[]) => {
    let call = 0;
    server.use(
      http.post(SAVE_URL, async ({ request }) => {
        const { p_ingredients } = z
          .object({ p_ingredients: z.array(z.unknown()) })
          .parse(await request.json());
        savedIngredients.push(p_ingredients);
        const answer = answers[Math.min(call, answers.length - 1)];
        call += 1;
        if (answer === undefined) {
          throw new Error("No answer was given");
        }
        return answer();
      }),
      http.get(PORTIONS_URL, ({ request }) => {
        portionLookups.push(new URL(request.url).searchParams.get("id") ?? "");
        return postgrestRows(
          request,
          livePortionIds.map((id) => ({ id })),
        );
      }),
      http.get(`${REST_URL}/recipes`, ({ request }) =>
        postgrestRows(request, [recipeDetailRow({ id: RECIPE_ID })]),
      ),
    );
  };
  const saved = () => HttpResponse.json(RECIPE_ID);
  const portionIdsOf = (rows: unknown[]) =>
    rows.map((row) => z.object({ portion_id: z.string().nullable() }).parse(row).portion_id);

  beforeEach(() => {
    savedIngredients = [];
    portionLookups = [];
  });

  it.each([
    ["a foreign key violation naming portion_id", "23503", ingredientForeignKey("portion_id")],
    [
      "a row level security refusal",
      "42501",
      'new row violates row-level security policy for table "recipe_ingredients"',
    ],
  ])(
    "should save again with no portion on the dead ones only after %s",
    async (_name, code, message) => {
      answerSaves([refused(code, message), saved], [LIVE_PORTION_ID]);

      const recipe = await createRecipe(createTestClient(), save);

      expect(recipe.id).toBe(RECIPE_ID);
      expect(savedIngredients).toHaveLength(2);
      expect(portionIdsOf(savedIngredients[0] ?? [])).toEqual([DEAD_PORTION_ID, LIVE_PORTION_ID]);
      expect(portionIdsOf(savedIngredients[1] ?? [])).toEqual([null, LIVE_PORTION_ID]);
      expect(portionLookups).toEqual([`in.(${DEAD_PORTION_ID},${LIVE_PORTION_ID})`]);
    },
  );

  it("should keep the snapshot and the amount of the ingredient whose portion went", async () => {
    answerSaves([refused("23503", ingredientForeignKey("portion_id")), saved], [LIVE_PORTION_ID]);

    await createRecipe(createTestClient(), save);

    expect(savedIngredients[1]?.[0]).toEqual({
      ...JSON.parse(JSON.stringify(ingredients[0])),
      portion_id: null,
    });
  });

  it("should throw the first error without saving again when every portion still exists", async () => {
    answerSaves(
      [
        refused(
          "42501",
          'new row violates row-level security policy for table "recipe_ingredients"',
        ),
        saved,
      ],
      [DEAD_PORTION_ID, LIVE_PORTION_ID],
    );

    const failure = await createRecipe(createTestClient(), save).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(savedIngredients).toHaveLength(1);
  });

  it("should not look at the portions after another foreign key violation", async () => {
    answerSaves([refused("23503", ingredientForeignKey("food_id")), saved], []);

    const failure = await createRecipe(createTestClient(), save).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(savedIngredients).toHaveLength(1);
    expect(portionLookups).toEqual([]);
  });

  it("should not look at the portions for a recipe whose ingredients carry none", async () => {
    answerSaves([refused("23503", ingredientForeignKey("portion_id"))], []);

    const failure = await createRecipe(createTestClient(), {
      ...save,
      ingredients: [buildRecipeIngredient(food, { quantity: 100, unit: "g" })],
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(savedIngredients).toHaveLength(1);
    expect(portionLookups).toEqual([]);
  });
});
