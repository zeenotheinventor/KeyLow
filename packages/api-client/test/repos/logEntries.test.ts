import { buildLogEntry, buildRecipeLogEntry } from "@keylow/core/diary";
import { buildFood, buildFoodPortion } from "@keylow/core/testing";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { logEntries } from "../../src/repos/diaryWrites";
import { createTestClient } from "../createTestClient";
import { FOOD_ID } from "../support/diary";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
import { RECIPE_DAY, loggableRecipe } from "../support/recipeEntries";

import type { LogEntriesItem, LogFoodInput } from "../../src/repos/diaryWrites";
import type { LogRecipeInput } from "../../src/repos/recipeEntries";

// The plate logs every food and recipe serving on it in one request. These tests say what the repo
// sends and what it does when the database refuses. Nothing here puts a food, an amount or a recipe
// in an assertion about an error.

const ENTRIES_URL = `${REST_URL}/food_log_entries`;
const PORTIONS_URL = `${REST_URL}/food_portions`;

const DEAD_PORTION_ID = "99999999-9999-4999-8999-999999999999";
const LIVE_PORTION_ID = "88888888-8888-4888-8888-888888888888";

const bodySchema = z.array(z.record(z.string(), z.unknown()));

const server = setupServer();

let bodies: z.infer<typeof bodySchema>[] = [];
let portionLookups: string[] = [];

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  bodies = [];
  portionLookups = [];
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const storedAs = (body: z.infer<typeof bodySchema>) =>
  body.map((row, index) => ({
    ...row,
    id: `00000000-0000-4000-8000-00000000000${index}`,
    created_at: "2026-10-15T12:00:01.123456+00:00",
    kcal: 100,
  }));

/**
 * Answers the inserts into the entries table one after the other, recording the body of each. An
 * answer is a refusal, or null to store the rows the request carried.
 */
function answerInserts(answers: ((() => Response) | null)[]) {
  let call = 0;
  server.use(
    http.post(ENTRIES_URL, async ({ request }) => {
      const body = bodySchema.parse(await request.clone().json());
      bodies.push(body);
      const answer = answers[Math.min(call, answers.length - 1)] ?? null;
      call += 1;
      return answer === null ? postgrestRows(request, storedAs(body), 201) : answer();
    }),
  );
}

const answerPortionLookups = (livePortionIds: string[]) => {
  server.use(
    http.get(PORTIONS_URL, ({ request }) => {
      portionLookups.push(new URL(request.url).searchParams.get("id") ?? "");
      return postgrestRows(
        request,
        livePortionIds.map((id) => ({ id })),
      );
    }),
  );
};

// A response body can be read once, so a refusal is made when it is sent.
const refused = (code: string, message: string) => () =>
  postgrestError(code === "42501" ? 403 : 409, code, message);
const deadPortionRefusal = () =>
  refused(
    "23503",
    'insert or update on table "food_log_entries" violates foreign key constraint "food_log_entries_portion_id_fkey"',
  );

const oats = buildFood({ id: FOOD_ID, name: "Rolled oats", kcal: 200 });
const cola = buildFood({ id: "55555555-5555-4555-8555-555555555555", name: "Cola", kcal: 42 });
const deadPortion = buildFoodPortion({
  id: DEAD_PORTION_ID,
  food_id: cola.id,
  label: "1 can",
  grams: 330,
});
const livePortion = buildFoodPortion({
  id: LIVE_PORTION_ID,
  food_id: oats.id,
  label: "1 bowl",
  grams: 40,
});

const NOON = `${RECIPE_DAY}T12:00:00.000Z`;
const timing = { loggedAt: NOON, localDate: RECIPE_DAY } as const;

const oatsInput: LogFoodInput = { food: oats, quantity: 50, unit: "g", ...timing };
const stewInput: LogRecipeInput = {
  recipe: loggableRecipe,
  quantity: 1,
  unit: "serving",
  ...timing,
};

const oatsInGrams: LogEntriesItem = { kind: "food", input: oatsInput };
const colaInCans: LogEntriesItem = {
  kind: "food",
  input: { food: cola, quantity: 1, unit: "portion", portion: deadPortion, ...timing },
};
const oatsInBowls: LogEntriesItem = {
  kind: "food",
  input: { food: oats, quantity: 2, unit: "portion", portion: livePortion, ...timing },
};
const stewServing: LogEntriesItem = { kind: "recipe", input: stewInput };

const plate = [oatsInGrams, stewServing, colaInCans, oatsInBowls];

const messageOf = (failure: unknown) => (failure instanceof Error ? failure.message : "");

describe("logEntries", () => {
  describe("one request", () => {
    it("should send one request with every row of the plate, in the order given", async () => {
      answerInserts([null]);

      await logEntries(createTestClient(), plate);

      expect(bodies).toHaveLength(1);
      expect(bodies[0]?.map(({ item_type }) => item_type)).toEqual([
        "food",
        "recipe",
        "food",
        "food",
      ]);
    });

    it("should send each row as the builders of core make it", async () => {
      answerInserts([null]);

      await logEntries(createTestClient(), plate);

      const [first, second, third, fourth] = bodies[0] ?? [];
      // Only the time differs from what core builds: the i-th row is i milliseconds later.
      expect(first).toEqual(buildLogEntry(oatsInput));
      expect(second).toEqual({
        ...buildRecipeLogEntry(stewInput),
        logged_at: `${RECIPE_DAY}T12:00:00.001Z`,
      });
      expect(third).toMatchObject({ food_id: cola.id, portion_id: DEAD_PORTION_ID, quantity: 1 });
      expect(fourth).toMatchObject({ food_id: oats.id, portion_id: LIVE_PORTION_ID, quantity: 2 });
    });

    it("should log one food twice as two rows", async () => {
      answerInserts([null]);

      await logEntries(createTestClient(), [oatsInGrams, oatsInGrams]);

      expect(bodies[0]).toHaveLength(2);
    });

    it("should resolve to the stored rows in the order given, each parsed as its kind", async () => {
      answerInserts([null]);

      const stored = await logEntries(createTestClient(), plate);

      expect(stored.map(({ item_type }) => item_type)).toEqual(["food", "recipe", "food", "food"]);
      expect(stored.map(({ id }) => id)).toEqual([
        "00000000-0000-4000-8000-000000000000",
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
        "00000000-0000-4000-8000-000000000003",
      ]);
    });

    it("should throw when the database answers with a different number of rows than were sent", async () => {
      server.use(http.post(ENTRIES_URL, ({ request }) => postgrestRows(request, [], 201)));

      const failure = await logEntries(createTestClient(), plate).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(Error);
    });
  });

  describe("the order in the diary", () => {
    it("should log the i-th row i milliseconds after the time given, and keep the day", async () => {
      answerInserts([null]);

      await logEntries(createTestClient(), plate);

      expect(bodies[0]?.map(({ logged_at }) => logged_at)).toEqual([
        `${RECIPE_DAY}T12:00:00.000Z`,
        `${RECIPE_DAY}T12:00:00.001Z`,
        `${RECIPE_DAY}T12:00:00.002Z`,
        `${RECIPE_DAY}T12:00:00.003Z`,
      ]);
      expect(bodies[0]?.map(({ local_date }) => local_date)).toEqual(Array(4).fill(RECIPE_DAY));
    });

    it("should offset from the time each row was given, not from the first", async () => {
      answerInserts([null]);
      const evening = {
        ...oatsInGrams,
        input: { ...oatsInput, loggedAt: `${RECIPE_DAY}T18:30:00+01:00` },
      } satisfies LogEntriesItem;

      await logEntries(createTestClient(), [oatsInGrams, evening]);

      expect(bodies[0]?.map(({ logged_at }) => logged_at)).toEqual([
        `${RECIPE_DAY}T12:00:00.000Z`,
        `${RECIPE_DAY}T17:30:00.001Z`,
      ]);
    });
  });

  describe("a row that is not valid", () => {
    it("should send nothing when the first row has a negative amount", async () => {
      answerInserts([null]);
      const negative = { kind: "food", input: { ...oatsInput, quantity: -1 } } as const;

      const failure = await logEntries(createTestClient(), [negative, stewServing]).catch(
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(RangeError);
      expect(bodies).toEqual([]);
    });

    it("should send nothing when only the last row has a negative amount", async () => {
      answerInserts([null]);
      const negative = {
        kind: "recipe",
        input: { ...stewInput, quantity: -1 },
      } as const;

      const failure = await logEntries(createTestClient(), [oatsInGrams, negative]).catch(
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(RangeError);
      expect(bodies).toEqual([]);
    });

    it("should send nothing when a time is malformed", async () => {
      answerInserts([null]);
      const malformed = {
        kind: "food",
        input: { ...oatsInput, loggedAt: "yesterday evening" },
      } as const;

      const failure = await logEntries(createTestClient(), [oatsInGrams, malformed]).catch(
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(RangeError);
      expect(bodies).toEqual([]);
    });

    it("should name the action and not the food or the amount in the error", async () => {
      const negative = {
        kind: "food",
        input: { ...oatsInput, quantity: -123.456 },
      } as const;

      const failure = await logEntries(createTestClient(), [negative]).catch(
        (error: unknown) => error,
      );

      expect(messageOf(failure)).toMatch(/^Could not log the entries/);
      expect(messageOf(failure)).not.toMatch(/123|oats/i);
    });

    it("should send nothing and throw a RangeError for an empty list", async () => {
      answerInserts([null]);

      const failure = await logEntries(createTestClient(), []).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(RangeError);
      expect(bodies).toEqual([]);
    });
  });

  describe("a refusal by the database", () => {
    it("should throw an error with the action and the code only, and store nothing", async () => {
      answerInserts([
        () =>
          postgrestError(
            403,
            "42501",
            'new row violates row-level security policy: "Rolled oats"',
            {
              details: "Failing row contains (50, Rolled oats)",
            },
          ),
      ]);

      const failure = await logEntries(createTestClient(), [oatsInGrams]).catch(
        (error: unknown) => error,
      );

      expect(failure).toHaveProperty("message", "Could not log the entries (42501)");
      expect(failure).toHaveProperty("cause", { code: "42501" });
    });

    it("should not send the rows again after a refusal that is not about a portion", async () => {
      answerInserts([refused("23514", "check violation")]);

      await logEntries(createTestClient(), plate).catch(() => undefined);

      expect(bodies).toHaveLength(1);
      expect(portionLookups).toEqual([]);
    });
  });

  describe("a portion that no longer exists", () => {
    it("should list the portions once, then send the whole batch again with no portion on the dead row only", async () => {
      answerInserts([deadPortionRefusal(), null]);
      answerPortionLookups([LIVE_PORTION_ID]);

      const stored = await logEntries(createTestClient(), plate);

      expect(portionLookups).toEqual([`in.(${DEAD_PORTION_ID},${LIVE_PORTION_ID})`]);
      expect(bodies).toHaveLength(2);
      expect(bodies[0]?.map(({ portion_id }) => portion_id)).toEqual([
        null,
        null,
        DEAD_PORTION_ID,
        LIVE_PORTION_ID,
      ]);
      expect(bodies[1]?.map(({ portion_id }) => portion_id)).toEqual([
        null,
        null,
        null,
        LIVE_PORTION_ID,
      ]);
      expect(stored).toHaveLength(4);
    });

    it("should keep the snapshot, the amount and the time of the row that lost its portion", async () => {
      answerInserts([deadPortionRefusal(), null]);
      answerPortionLookups([LIVE_PORTION_ID]);

      await logEntries(createTestClient(), plate);

      const [first, second] = bodies;
      expect(second).toEqual(
        first?.map((row, index) => (index === 2 ? { ...row, portion_id: null } : row)),
      );
      expect(second?.[2]).toMatchObject({
        unit: "portion",
        quantity: 1,
        snapshot: { portion: { label: "1 can", grams: 330 } },
      });
    });

    it("should also retry after a row level security refusal", async () => {
      answerInserts([
        refused("42501", 'new row violates row-level security policy for table "food_log_entries"'),
        null,
      ]);
      answerPortionLookups([LIVE_PORTION_ID]);

      await logEntries(createTestClient(), plate);

      expect(bodies).toHaveLength(2);
    });

    it("should send only twice, and throw, when the second attempt is refused too", async () => {
      answerInserts([deadPortionRefusal()]);
      answerPortionLookups([LIVE_PORTION_ID]);

      const failure = await logEntries(createTestClient(), plate).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(Error);
      expect(bodies).toHaveLength(2);
      expect(portionLookups).toHaveLength(1);
    });

    it("should throw the first error without sending again when every portion still exists", async () => {
      answerInserts([deadPortionRefusal(), null]);
      answerPortionLookups([DEAD_PORTION_ID, LIVE_PORTION_ID]);

      const failure = await logEntries(createTestClient(), plate).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(Error);
      expect(bodies).toHaveLength(1);
    });

    it("should throw the first error without sending again when the portions cannot be read", async () => {
      answerInserts([deadPortionRefusal(), null]);
      server.use(http.get(PORTIONS_URL, () => postgrestError(500, "XX000", "unavailable")));

      const failure = await logEntries(createTestClient(), plate).catch((error: unknown) => error);

      expect(failure).toHaveProperty("message", "Could not log the entries (23503)");
      expect(bodies).toHaveLength(1);
    });

    it("should not look at the portions for a batch whose rows carry none", async () => {
      answerInserts([deadPortionRefusal(), null]);

      const failure = await logEntries(createTestClient(), [oatsInGrams, stewServing]).catch(
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(Error);
      expect(bodies).toHaveLength(1);
      expect(portionLookups).toEqual([]);
    });
  });
});
