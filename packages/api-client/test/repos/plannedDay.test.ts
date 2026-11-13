import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { confirmPlannedDay } from "../../src/repos/plannedDay";
import { createTestClient } from "../createTestClient";
import { REST_URL, foodRow, postgrestRows } from "../support/postgrest";
import {
  databaseErrorQuotingTheRow,
  errorThrownBy,
  expectOnlyTheCode,
} from "../support/quotedDatabaseError";
import { RECIPE_ID, recipeDetailRow } from "../support/recipes";

import type { MealPlanDay } from "../../src/repos/mealPlans";

const DAY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FOOD_ID = foodRow().id;
const ENTRY_ID = "77777777-7777-4777-8777-777777777777";
const OTHER_ENTRY_ID = "88888888-8888-4888-8888-888888888888";

type Recorded = { path: string; body: unknown };
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

const planned = (overrides: Partial<MealPlanDay> = {}): MealPlanDay => ({
  id: DAY_ID,
  localDate: "2026-12-14",
  target: { kcal: 1800 },
  confirmedAt: null,
  confirmedEntryIds: null,
  items: [
    {
      kind: "food",
      id: "d1",
      position: 0,
      slotTime: "07:30:00",
      foodId: FOOD_ID,
      grams: 50,
      portionId: null,
      nutrients: {},
      leftoverOf: null,
      snapshot: {},
    },
    {
      kind: "recipe",
      id: "d2",
      position: 1,
      slotTime: "19:00:00",
      recipeId: RECIPE_ID,
      servings: 1,
      nutrients: {},
      leftoverOf: null,
      snapshot: {},
    },
  ],
  ...overrides,
});

const serve = ({
  foods = [foodRow()],
  recipes = [recipeDetailRow()],
}: { foods?: unknown[]; recipes?: unknown[] } = {}) => {
  server.use(
    http.get(`${REST_URL}/foods`, ({ request }) => {
      recorded.push({ path: "foods", body: null });
      return postgrestRows(request, foods);
    }),
    http.get(`${REST_URL}/recipes`, ({ request }) => {
      recorded.push({ path: "recipes", body: null });
      return postgrestRows(request, recipes);
    }),
    http.post(`${REST_URL}/rpc/confirm_meal_plan_day`, async ({ request }) => {
      recorded.push({ path: "confirm", body: await request.clone().json() });
      return HttpResponse.json([ENTRY_ID, OTHER_ENTRY_ID]);
    }),
  );
};

const confirmCalls = () => recorded.filter(({ path }) => path === "confirm");

describe("confirmPlannedDay", () => {
  it("should write the day's items through confirm_meal_plan_day, each at its time (the batch staggers its rows by a millisecond)", async () => {
    serve();

    const ids = await confirmPlannedDay(createTestClient(), planned(), "Europe/London");

    expect(ids).toStrictEqual([ENTRY_ID, OTHER_ENTRY_ID]);
    expect(confirmCalls()).toHaveLength(1);
    expect(confirmCalls()[0]?.body).toMatchObject({
      p_day_id: DAY_ID,
      p_entries: [
        {
          item_type: "food",
          food_id: FOOD_ID,
          quantity: 50,
          unit: "g",
          logged_at: "2026-12-14T07:30:00.000Z",
        },
        {
          item_type: "recipe",
          recipe_id: RECIPE_ID,
          quantity: 1,
          unit: "serving",
          logged_at: "2026-12-14T19:00:00.001Z",
        },
      ],
    });
  });

  it("should refuse a day that is already confirmed before any request, with the database's own code", async () => {
    serve();

    const error = await errorThrownBy(() =>
      confirmPlannedDay(
        createTestClient(),
        planned({ confirmedAt: "2026-12-14T09:00:00+00:00" }),
        "Europe/London",
      ),
    );

    expectOnlyTheCode(error, "confirm this day", "22023");
    expect(recorded).toEqual([]);
  });

  it("should refuse a day with nothing planned before any request", async () => {
    serve();

    const error = await errorThrownBy(() =>
      confirmPlannedDay(createTestClient(), planned({ items: [] }), "Europe/London"),
    );

    expectOnlyTheCode(error, "confirm this day", "empty");
    expect(recorded).toEqual([]);
  });

  it("should refuse a day whose food has gone, and write nothing", async () => {
    serve({ foods: [] });

    const error = await errorThrownBy(() =>
      confirmPlannedDay(createTestClient(), planned(), "Europe/London"),
    );

    expectOnlyTheCode(error, "confirm this day", "gone");
    expect(confirmCalls()).toEqual([]);
  });

  it("should treat a deleted food as gone", async () => {
    serve({ foods: [foodRow({ deleted_at: "2026-12-01T10:00:00+00:00" })] });

    const error = await errorThrownBy(() =>
      confirmPlannedDay(createTestClient(), planned(), "Europe/London"),
    );

    expectOnlyTheCode(error, "confirm this day", "gone");
  });

  it("should refuse a day whose recipe was deleted, and write nothing", async () => {
    serve({ recipes: [] });

    const error = await errorThrownBy(() =>
      confirmPlannedDay(createTestClient(), planned(), "Europe/London"),
    );

    expectOnlyTheCode(error, "confirm this day", "gone");
    expect(confirmCalls()).toEqual([]);
  });

  it("should fail with the action and the code only when the database refuses a day confirmed meanwhile", async () => {
    serve();
    server.use(
      http.post(`${REST_URL}/rpc/confirm_meal_plan_day`, () => databaseErrorQuotingTheRow("22023")),
    );

    const error = await errorThrownBy(() =>
      confirmPlannedDay(createTestClient(), planned(), "Europe/London"),
    );

    expectOnlyTheCode(error, "confirm this day", "22023");
  });
});
