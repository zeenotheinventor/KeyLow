import { buildRecipeLogEntry } from "@keylow/core/diary";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { logRecipe } from "../../src/repos/recipeEntries";
import { createTestClient } from "../createTestClient";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
import {
  RECIPE_DAY,
  RECIPE_ID,
  loggableRecipe,
  recipeEntryRow,
  servingInput,
} from "../support/recipeEntries";

type Recorded = { method: string; url: URL; body: unknown };

const recorded: Recorded[] = [];
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  recorded.length = 0;
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

/** Answers an insert into the entries table with the given rows, and records it. */
function answerInsert(rows: unknown[]) {
  server.use(
    http.post(`${REST_URL}/food_log_entries`, async ({ request }) => {
      recorded.push({
        method: request.method,
        url: new URL(request.url),
        body: await request.json(),
      });
      return postgrestRows(request, rows, 201);
    }),
  );
}

const messageOf = (failure: unknown) => (failure instanceof Error ? failure.message : "");

describe("logRecipe", () => {
  it("should insert the entry core builds and return the stored row", async () => {
    const stored = recipeEntryRow();
    answerInsert([stored]);

    const entry = await logRecipe(createTestClient(), servingInput);

    expect(entry).toEqual(stored);
    const [write] = recorded;
    expect(write?.method).toBe("POST");
    expect(write?.body).toEqual(buildRecipeLogEntry(servingInput));
  });

  it("should insert a recipe entry with the recipe set and no food", async () => {
    answerInsert([recipeEntryRow()]);

    await logRecipe(createTestClient(), servingInput);

    expect(recorded[0]?.body).toMatchObject({
      item_type: "recipe",
      recipe_id: RECIPE_ID,
      food_id: null,
      portion_id: null,
      quantity: 1,
      unit: "serving",
      snapshot: { kind: "recipe", ref: RECIPE_ID },
    });
  });

  it("should insert the grams of cooked weight that core resolves", async () => {
    const byGrams = { ...servingInput, quantity: 275, unit: "g" } as const;
    answerInsert([recipeEntryRow(byGrams)]);

    await logRecipe(createTestClient(), byGrams);

    expect(recorded[0]?.body).toEqual(buildRecipeLogEntry(byGrams));
    expect(recorded[0]?.body).toMatchObject({ quantity: 275, unit: "g", resolved_grams: 275 });
  });

  it("should send no column the client may not write", async () => {
    answerInsert([recipeEntryRow()]);

    await logRecipe(createTestClient(), servingInput);

    for (const column of ["id", "user_id", "created_at", "kcal", "deleted_at"]) {
      expect(recorded[0]?.body).not.toHaveProperty(column);
    }
  });

  it("should ask for the recipe column back, which the diary reads leave out", async () => {
    answerInsert([recipeEntryRow()]);

    await logRecipe(createTestClient(), servingInput);

    expect(recorded[0]?.url.searchParams.get("select")?.split(",")).toContain("recipe_id");
  });

  describe("an input that is not valid", () => {
    it.each([
      ["a quantity below zero", { ...servingInput, quantity: -1 }],
      ["a quantity that is not a number", { ...servingInput, quantity: Number.NaN }],
      ["an amount too large to work out", { ...servingInput, quantity: Number.MAX_VALUE }],
      [
        "a recipe with no servings",
        { ...servingInput, recipe: { ...loggableRecipe, servings: 0 } },
      ],
    ])("should throw a RangeError and ask nothing for %s", async (_name, input) => {
      answerInsert([recipeEntryRow()]);

      const failure = await logRecipe(createTestClient(), input).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(RangeError);
      expect(messageOf(failure)).toBe(
        "Could not log the recipe: the amount or the recipe is not valid",
      );
      expect(recorded).toEqual([]);
    });

    it("should throw a RangeError and ask nothing for a unit that is not serving or g", async () => {
      answerInsert([recipeEntryRow()]);

      // A caller past the types, as a screen reading a unit from storage could be.
      // @ts-expect-error "portion" is not a recipe unit
      const input: Parameters<typeof logRecipe>[1] = { ...servingInput, unit: "portion" };
      const failure = await logRecipe(createTestClient(), input).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(RangeError);
      expect(recorded).toEqual([]);
    });

    it("should throw and ask nothing, naming the field only, when the day is not a calendar date", async () => {
      answerInsert([recipeEntryRow()]);

      const failure = await logRecipe(createTestClient(), {
        ...servingInput,
        localDate: "2026-02-30",
      }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(RangeError);
      expect(messageOf(failure)).toContain("local_date");
      expect(messageOf(failure)).not.toContain(loggableRecipe.name);
      expect(recorded).toEqual([]);
    });

    it("should throw and ask nothing when the time has no offset", async () => {
      answerInsert([recipeEntryRow()]);

      const failure = await logRecipe(createTestClient(), {
        ...servingInput,
        loggedAt: `${RECIPE_DAY}T12:00:00`,
      }).catch((error: unknown) => error);

      expect(messageOf(failure)).toContain("logged_at");
      expect(recorded).toEqual([]);
    });
  });

  describe("when the database refuses", () => {
    it("should throw an error with the action and the code only", async () => {
      server.use(
        http.post(`${REST_URL}/food_log_entries`, () =>
          postgrestError(403, "42501", `denied for ${loggableRecipe.name}`, {
            details: "Failing row contains 1496.8 kcal",
          }),
        ),
      );

      const failure = await logRecipe(createTestClient(), servingInput).catch(
        (error: unknown) => error,
      );

      expect(messageOf(failure)).toBe("Could not log the recipe (42501)");
      expect(failure).toHaveProperty("cause", { code: "42501" });
    });
  });

  describe("when the stored row does not read back", () => {
    it("should name the row and the field, never the values", async () => {
      const stored = recipeEntryRow();
      answerInsert([{ ...stored, recipe_id: null, snapshot: { ...stored.snapshot, name: 42 } }]);

      const failure = await logRecipe(createTestClient(), servingInput).catch(
        (error: unknown) => error,
      );

      expect(messageOf(failure)).toContain(stored.id);
      expect(messageOf(failure)).toContain("recipe_id");
      expect(messageOf(failure)).not.toContain(loggableRecipe.name);
      expect(failure).not.toHaveProperty("cause");
    });
  });
});
