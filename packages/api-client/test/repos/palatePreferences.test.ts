import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  addPalatePreference,
  getPalateLoggedDays,
  isDuplicatePalatePreference,
  listPalateFoods,
  listPalatePreferences,
  listPalateStats,
  removePalatePreference,
  setNotUsual,
} from "../../src/repos/palatePreferences";
import { repoError } from "../../src/repos/repoError";
import { createTestClient } from "../createTestClient";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
import {
  QUOTED_FOOD,
  databaseErrorQuotingTheRow,
  errorThrownBy,
  expectOnlyTheCode,
} from "../support/quotedDatabaseError";

const PREFERENCE_ID = "44444444-4444-4444-8444-444444444444";
const FOOD_ID = "55555555-5555-4555-8555-555555555555";
const RECIPE_ID = "66666666-6666-4666-8666-666666666666";
const OWNER_ID = "11111111-1111-4111-8111-111111111111";

const preferenceRow = (overrides: Record<string, unknown> = {}) => ({
  id: PREFERENCE_ID,
  owner_id: OWNER_ID,
  kind: "dislike",
  food_id: null,
  recipe_id: null,
  label: "stub word",
  created_at: "2026-11-13T10:00:00.123456+00:00",
  ...overrides,
});

const statRow = (overrides: Record<string, unknown> = {}) => ({
  owner_id: OWNER_ID,
  food_id: FOOD_ID,
  recipe_id: null,
  entry_count: 5,
  distinct_days: 3,
  first_local_date: "2026-08-16",
  last_local_date: "2026-11-13",
  median_resolved_grams: 300,
  before_eleven_count: 2,
  eleven_to_sixteen_count: 2,
  sixteen_or_later_count: 1,
  ...overrides,
});

type Recorded = { url: URL; method: string; body: unknown };

let recorded: Recorded[] = [];

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  recorded = [];
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const record = async (request: Request) => {
  const text = await request.clone().text();
  recorded.push({
    url: new URL(request.url),
    method: request.method,
    body: text === "" ? null : JSON.parse(text),
  });
};

const answer = (
  method: "get" | "post" | "delete",
  table: string,
  respond: (request: Request) => Response,
) => {
  server.use(
    http[method](`${REST_URL}/${table}`, async ({ request }) => {
      await record(request);
      return respond(request);
    }),
  );
};

describe("listPalatePreferences", () => {
  it("should read the person's rows oldest first, as camel case objects without the owner", async () => {
    answer("get", "palate_preferences", (request) =>
      postgrestRows(request, [
        preferenceRow(),
        preferenceRow({
          id: "77777777-7777-4777-8777-777777777777",
          kind: "not_usual",
          label: null,
          food_id: FOOD_ID,
        }),
      ]),
    );

    const preferences = await listPalatePreferences(createTestClient());

    expect(preferences).toStrictEqual([
      {
        id: PREFERENCE_ID,
        kind: "dislike",
        foodId: null,
        recipeId: null,
        label: "stub word",
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        kind: "not_usual",
        foodId: FOOD_ID,
        recipeId: null,
        label: null,
      },
    ]);
    expect(recorded[0]?.url.searchParams.get("order")).toBe("created_at.asc,id.asc");
    expect(recorded[0]?.url.searchParams.get("select")).toBe("id,kind,food_id,recipe_id,label");
  });

  it("should fail with the action and the code only when the database quotes the row", async () => {
    answer("get", "palate_preferences", () => databaseErrorQuotingTheRow("42501"));

    const error = await errorThrownBy(() => listPalatePreferences(createTestClient()));

    expectOnlyTheCode(error, "load your palate preferences", "42501");
  });

  it("should name the row id and the field paths, never a value, when a row has an unexpected shape", async () => {
    answer("get", "palate_preferences", (request) =>
      postgrestRows(request, [preferenceRow({ kind: QUOTED_FOOD })]),
    );

    const error = await errorThrownBy(() => listPalatePreferences(createTestClient()));

    expect(error.message).toContain(PREFERENCE_ID);
    expect(error.message).toContain("kind");
    expect(`${error.message} ${JSON.stringify(error.cause)}`).not.toContain(QUOTED_FOOD);
  });
});

describe("addPalatePreference", () => {
  it("should insert a trimmed label with its kind and resolve to the row as stored", async () => {
    answer("post", "palate_preferences", (request) =>
      postgrestRows(request, [preferenceRow({ kind: "allergy" })], 201),
    );

    const added = await addPalatePreference(createTestClient(), {
      kind: "allergy",
      label: "  stub word  ",
    });

    expect(recorded[0]?.body).toStrictEqual({ kind: "allergy", label: "stub word" });
    expect(added).toStrictEqual({
      id: PREFERENCE_ID,
      kind: "allergy",
      foodId: null,
      recipeId: null,
      label: "stub word",
    });
  });

  it("should refuse a blank label without sending anything", async () => {
    const error = await errorThrownBy(() =>
      addPalatePreference(createTestClient(), { kind: "dislike", label: "   " }),
    );

    expect(error.message).toBe("Could not add to your palate (invalid)");
    expect(recorded).toHaveLength(0);
  });

  it("should refuse a label over 100 characters without sending anything", async () => {
    const error = await errorThrownBy(() =>
      addPalatePreference(createTestClient(), { kind: "dislike", label: "k".repeat(101) }),
    );

    expect(error.message).toBe("Could not add to your palate (invalid)");
    expect(recorded).toHaveLength(0);
  });

  it("should accept a label of exactly 100 characters", async () => {
    answer("post", "palate_preferences", (request) =>
      postgrestRows(request, [preferenceRow()], 201),
    );

    await addPalatePreference(createTestClient(), { kind: "dislike", label: "k".repeat(100) });

    expect(recorded).toHaveLength(1);
  });

  it("should fail with the action and the code only when the database quotes the row", async () => {
    answer("post", "palate_preferences", () => databaseErrorQuotingTheRow("23514"));

    const error = await errorThrownBy(() =>
      addPalatePreference(createTestClient(), { kind: "allergy", label: "stub word" }),
    );

    expectOnlyTheCode(error, "add to your palate", "23514");
  });
});

describe("setNotUsual", () => {
  it("should insert a not_usual row for a food", async () => {
    answer("post", "palate_preferences", (request) =>
      postgrestRows(
        request,
        [preferenceRow({ kind: "not_usual", food_id: FOOD_ID, label: null })],
        201,
      ),
    );

    await setNotUsual(createTestClient(), { foodId: FOOD_ID });

    expect(recorded[0]?.body).toStrictEqual({ kind: "not_usual", food_id: FOOD_ID });
  });

  it("should insert a not_usual row for a recipe", async () => {
    answer("post", "palate_preferences", (request) =>
      postgrestRows(
        request,
        [preferenceRow({ kind: "not_usual", recipe_id: RECIPE_ID, label: null })],
        201,
      ),
    );

    await setNotUsual(createTestClient(), { recipeId: RECIPE_ID });

    expect(recorded[0]?.body).toStrictEqual({ kind: "not_usual", recipe_id: RECIPE_ID });
  });

  it("should insert a not_usual row for a trimmed label", async () => {
    answer("post", "palate_preferences", (request) =>
      postgrestRows(request, [preferenceRow({ kind: "not_usual" })], 201),
    );

    await setNotUsual(createTestClient(), { label: "  stub word " });

    expect(recorded[0]?.body).toStrictEqual({ kind: "not_usual", label: "stub word" });
  });

  it("should treat a correction that is already stored as done", async () => {
    answer("post", "palate_preferences", () =>
      postgrestError(
        409,
        "23505",
        `duplicate key value violates unique constraint: ${QUOTED_FOOD}`,
      ),
    );

    await expect(setNotUsual(createTestClient(), { foodId: FOOD_ID })).resolves.toBeUndefined();
  });

  it("should fail with the action and the code only on any other failure", async () => {
    answer("post", "palate_preferences", () => databaseErrorQuotingTheRow("42501"));

    const error = await errorThrownBy(() => setNotUsual(createTestClient(), { foodId: FOOD_ID }));

    expectOnlyTheCode(error, "mark this as not usual", "42501");
  });
});

describe("removePalatePreference", () => {
  it("should delete the row by its id", async () => {
    answer("delete", "palate_preferences", () => new Response(null, { status: 204 }));

    await removePalatePreference(createTestClient(), PREFERENCE_ID);

    expect(recorded[0]?.method).toBe("DELETE");
    expect(recorded[0]?.url.searchParams.get("id")).toBe(`eq.${PREFERENCE_ID}`);
  });

  it("should fail with the action and the code only when the database quotes the row", async () => {
    answer("delete", "palate_preferences", () => databaseErrorQuotingTheRow("42501"));

    const error = await errorThrownBy(() =>
      removePalatePreference(createTestClient(), PREFERENCE_ID),
    );

    expectOnlyTheCode(error, "remove this from your palate", "42501");
  });
});

describe("listPalateStats", () => {
  it("should read the view and map each row to camel case without the owner", async () => {
    answer("get", "palate_food_stats", (request) =>
      postgrestRows(request, [
        statRow(),
        statRow({ food_id: null, recipe_id: RECIPE_ID, median_resolved_grams: null }),
      ]),
    );

    const stats = await listPalateStats(createTestClient());

    expect(stats).toStrictEqual([
      {
        foodId: FOOD_ID,
        recipeId: null,
        entryCount: 5,
        distinctDays: 3,
        firstLocalDate: "2026-08-16",
        lastLocalDate: "2026-11-13",
        medianResolvedGrams: 300,
        beforeElevenCount: 2,
        elevenToSixteenCount: 2,
        sixteenOrLaterCount: 1,
      },
      {
        foodId: null,
        recipeId: RECIPE_ID,
        entryCount: 5,
        distinctDays: 3,
        firstLocalDate: "2026-08-16",
        lastLocalDate: "2026-11-13",
        medianResolvedGrams: null,
        beforeElevenCount: 2,
        elevenToSixteenCount: 2,
        sixteenOrLaterCount: 1,
      },
    ]);
  });

  it("should ask for the most logged first, then the most recent", async () => {
    answer("get", "palate_food_stats", (request) => postgrestRows(request, []));

    await listPalateStats(createTestClient());

    expect(recorded[0]?.url.searchParams.get("order")).toBe(
      "entry_count.desc,last_local_date.desc,food_id.asc.nullslast,recipe_id.asc.nullslast",
    );
  });

  it("should fail with the action and the code only when the database quotes the row", async () => {
    answer("get", "palate_food_stats", () => databaseErrorQuotingTheRow("42501"));

    const error = await errorThrownBy(() => listPalateStats(createTestClient()));

    expectOnlyTheCode(error, "load what you eat most", "42501");
  });
});

describe("getPalateLoggedDays", () => {
  it("should read the count from the view", async () => {
    answer("get", "palate_logged_days", (request) => postgrestRows(request, [{ logged_days: 12 }]));

    await expect(getPalateLoggedDays(createTestClient())).resolves.toBe(12);
    expect(recorded[0]?.url.searchParams.get("select")).toBe("logged_days");
  });

  it("should read as 0 when the view has no row, because nothing is logged", async () => {
    answer("get", "palate_logged_days", (request) => postgrestRows(request, []));

    await expect(getPalateLoggedDays(createTestClient())).resolves.toBe(0);
  });

  it("should fail with the action and the code only when the database quotes the row", async () => {
    answer("get", "palate_logged_days", () => databaseErrorQuotingTheRow("42501"));

    const error = await errorThrownBy(() => getPalateLoggedDays(createTestClient()));

    expectOnlyTheCode(error, "load your logged days", "42501");
  });
});

describe("listPalateFoods", () => {
  const SECOND_FOOD_ID = "88888888-8888-4888-8888-888888888888";

  it("should read the four columns the palate needs for the foods asked for", async () => {
    answer("get", "foods", (request) =>
      postgrestRows(request, [
        { id: FOOD_ID, name: "Oats, rolled", source: "cofid", food_group: "A" },
      ]),
    );

    const foods = await listPalateFoods(createTestClient(), [FOOD_ID, SECOND_FOOD_ID]);

    expect(foods).toStrictEqual([
      { id: FOOD_ID, name: "Oats, rolled", source: "cofid", food_group: "A" },
    ]);
    expect(recorded[0]?.url.searchParams.get("select")).toBe("id,name,source,food_group");
    expect(recorded[0]?.url.searchParams.get("id")).toBe(`in.(${FOOD_ID},${SECOND_FOOD_ID})`);
  });

  it("should send nothing when no food is asked for", async () => {
    await expect(listPalateFoods(createTestClient(), [])).resolves.toStrictEqual([]);
    expect(recorded).toHaveLength(0);
  });

  it("should ask in requests of at most 100 ids and join the answers", async () => {
    const ids = Array.from(
      { length: 101 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );
    answer("get", "foods", (request) =>
      postgrestRows(request, [{ id: FOOD_ID, name: "Oats", source: "cofid", food_group: null }]),
    );

    const foods = await listPalateFoods(createTestClient(), ids);

    expect(recorded).toHaveLength(2);
    expect(recorded[0]?.url.searchParams.get("id")?.split(",")).toHaveLength(100);
    expect(foods).toHaveLength(2);
  });

  it("should fail with the action and the code only when the database quotes the row", async () => {
    answer("get", "foods", () => databaseErrorQuotingTheRow("42501"));

    const error = await errorThrownBy(() => listPalateFoods(createTestClient(), [FOOD_ID]));

    expectOnlyTheCode(error, "load the foods in your palate", "42501");
  });
});

describe("isDuplicatePalatePreference", () => {
  it("should be true for the error of a word added twice, and only for it", () => {
    expect(isDuplicatePalatePreference(repoError("add to your palate", { code: "23505" }))).toBe(
      true,
    );
    expect(isDuplicatePalatePreference(repoError("add to your palate", { code: "42501" }))).toBe(
      false,
    );
    expect(isDuplicatePalatePreference(new Error("no cause"))).toBe(false);
    expect(isDuplicatePalatePreference("23505")).toBe(false);
  });
});
