import { buildFood } from "@keylow/core/testing";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import {
  archiveMealPlan,
  confirmMealPlanDay,
  listMealPlans,
  replaceMealPlanDay,
  restoreMealPlan,
  saveMealPlan,
} from "../../src/repos/mealPlans";
import { createTestClient } from "../createTestClient";
import { REST_URL, postgrestRows } from "../support/postgrest";
import {
  QUOTED_FOOD,
  databaseErrorQuotingTheRow,
  errorThrownBy,
  expectOnlyTheCode,
} from "../support/quotedDatabaseError";

import type { MealPlanItemInput, SaveMealPlanInput } from "../../src/repos/mealPlans";

// The invented ids below are the same shape throughout, so a failure message names a row and no value.
const PLAN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FIRST_DAY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SECOND_DAY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ITEM_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OTHER_ITEM_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const FOOD_ID = "55555555-5555-4555-8555-555555555555";
const RECIPE_ID = "66666666-6666-4666-8666-666666666666";
const ENTRY_ID = "77777777-7777-4777-8777-777777777777";
const OTHER_ENTRY_ID = "88888888-8888-4888-8888-888888888888";

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
  method: "get" | "post" | "patch",
  path: string,
  respond: (request: Request) => Response,
) => {
  server.use(
    http[method](`${REST_URL}/${path}`, async ({ request }) => {
      await record(request);
      return respond(request);
    }),
  );
};

const itemRow = (overrides: Record<string, unknown> = {}) => ({
  id: ITEM_ID,
  position: 0,
  slot_time: "07:30:00",
  item_type: "recipe",
  food_id: null,
  recipe_id: RECIPE_ID,
  servings: 1,
  grams: null,
  portion_id: null,
  nutrients: { kcal: 400 },
  leftover_of: null,
  snapshot: { name: "stub recipe" },
  ...overrides,
});

const dayRow = (overrides: Record<string, unknown> = {}) => ({
  id: FIRST_DAY_ID,
  local_date: "2026-12-14",
  target: { kcal: 1800 },
  confirmed_at: null,
  confirmed_entry_ids: null,
  meal_plan_items: [itemRow()],
  ...overrides,
});

const planRow = (overrides: Record<string, unknown> = {}) => ({
  id: PLAN_ID,
  start_date: "2026-12-14",
  day_count: 2,
  rules: { maxRepeats: 2 },
  source: "assistant",
  archived_at: null,
  created_at: "2026-11-13T10:00:00.123456+00:00",
  meal_plan_days: [dayRow()],
  ...overrides,
});

type RecipeItemInput = Extract<MealPlanItemInput, { kind: "recipe" }>;
type FoodItemInput = Extract<MealPlanItemInput, { kind: "food" }>;

const recipeItem = (overrides: Partial<RecipeItemInput> = {}): RecipeItemInput => ({
  position: 0,
  slotTime: "07:30",
  kind: "recipe",
  recipeId: RECIPE_ID,
  servings: 1,
  nutrients: { kcal: 400 },
  snapshot: { name: "stub recipe" },
  ...overrides,
});

const foodItem = (overrides: Partial<FoodItemInput> = {}): FoodItemInput => ({
  position: 1,
  slotTime: "12:30",
  kind: "food",
  foodId: FOOD_ID,
  grams: 60,
  portionId: null,
  nutrients: { kcal: 150 },
  snapshot: { name: "stub food" },
  ...overrides,
});

const planInput = (overrides: Partial<SaveMealPlanInput> = {}): SaveMealPlanInput => ({
  startDate: "2026-12-14",
  source: "assistant",
  rules: { maxRepeats: 2, leftovers: true, slots: ["morning"] },
  days: [
    { localDate: "2026-12-14", target: { kcal: 1800 } },
    { localDate: "2026-12-15", target: { kcal: 1900 } },
  ],
  items: [
    { localDate: "2026-12-14", ...recipeItem() },
    { localDate: "2026-12-14", ...foodItem() },
    {
      localDate: "2026-12-15",
      ...recipeItem({ leftoverOf: { localDate: "2026-12-14", position: 0 } }),
    },
  ],
  ...overrides,
});

describe("listMealPlans", () => {
  it("should read the plans that are not archived with their days and items, in date and position order", async () => {
    answer("get", "meal_plans", (request) =>
      postgrestRows(request, [
        planRow({
          meal_plan_days: [
            dayRow({
              id: SECOND_DAY_ID,
              local_date: "2026-12-15",
              confirmed_at: "2026-12-15T09:00:00+00:00",
              confirmed_entry_ids: [ENTRY_ID],
              meal_plan_items: [],
            }),
            dayRow({
              meal_plan_items: [
                itemRow({
                  id: OTHER_ITEM_ID,
                  position: 1,
                  item_type: "food",
                  food_id: FOOD_ID,
                  recipe_id: null,
                  servings: null,
                  grams: 60,
                  slot_time: null,
                  leftover_of: ITEM_ID,
                }),
                itemRow(),
              ],
            }),
          ],
        }),
      ]),
    );

    const plans = await listMealPlans(createTestClient());

    expect(plans).toStrictEqual([
      {
        id: PLAN_ID,
        startDate: "2026-12-14",
        dayCount: 2,
        rules: { maxRepeats: 2 },
        source: "assistant",
        archivedAt: null,
        createdAt: "2026-11-13T10:00:00.123456+00:00",
        days: [
          {
            id: FIRST_DAY_ID,
            localDate: "2026-12-14",
            target: { kcal: 1800 },
            confirmedAt: null,
            confirmedEntryIds: null,
            items: [
              {
                id: ITEM_ID,
                position: 0,
                slotTime: "07:30:00",
                kind: "recipe",
                recipeId: RECIPE_ID,
                servings: 1,
                nutrients: { kcal: 400 },
                leftoverOf: null,
                snapshot: { name: "stub recipe" },
              },
              {
                id: OTHER_ITEM_ID,
                position: 1,
                slotTime: null,
                kind: "food",
                foodId: FOOD_ID,
                grams: 60,
                portionId: null,
                nutrients: { kcal: 400 },
                leftoverOf: ITEM_ID,
                snapshot: { name: "stub recipe" },
              },
            ],
          },
          {
            id: SECOND_DAY_ID,
            localDate: "2026-12-15",
            target: { kcal: 1800 },
            confirmedAt: "2026-12-15T09:00:00+00:00",
            confirmedEntryIds: [ENTRY_ID],
            items: [],
          },
        ],
      },
    ]);
    expect(recorded[0]?.url.searchParams.get("archived_at")).toBe("is.null");
    expect(recorded[0]?.url.searchParams.get("order")).toBe("start_date.asc,created_at.asc,id.asc");
  });

  it("should fail with the action and the code only when the database quotes the row", async () => {
    answer("get", "meal_plans", () => databaseErrorQuotingTheRow("42501"));

    const error = await errorThrownBy(() => listMealPlans(createTestClient()));

    expectOnlyTheCode(error, "load your meal plans", "42501");
  });

  it("should name the row id and the field paths, never a value, when a row has an unexpected shape", async () => {
    answer("get", "meal_plans", (request) =>
      postgrestRows(request, [planRow({ source: QUOTED_FOOD })]),
    );

    const error = await errorThrownBy(() => listMealPlans(createTestClient()));

    expect(error.message).toContain(PLAN_ID);
    expect(error.message).toContain("source");
    expect(`${error.message} ${JSON.stringify(error.cause)}`).not.toContain(QUOTED_FOOD);
  });
});

describe("saveMealPlan", () => {
  it("should send the plan, the days and the items to save_meal_plan and resolve to the new id", async () => {
    answer("post", "rpc/save_meal_plan", () => HttpResponse.json(PLAN_ID));

    const id = await saveMealPlan(createTestClient(), planInput());

    expect(id).toBe(PLAN_ID);
    expect(recorded[0]?.body).toStrictEqual({
      p_plan: {
        start_date: "2026-12-14",
        day_count: 2,
        rules: { maxRepeats: 2, leftovers: true, slots: ["morning"] },
        source: "assistant",
      },
      p_days: [
        { local_date: "2026-12-14", target: { kcal: 1800 } },
        { local_date: "2026-12-15", target: { kcal: 1900 } },
      ],
      p_items: [
        {
          local_date: "2026-12-14",
          position: 0,
          slot_time: "07:30",
          item_type: "recipe",
          recipe_id: RECIPE_ID,
          servings: 1,
          nutrients: { kcal: 400 },
          snapshot: { name: "stub recipe" },
        },
        {
          local_date: "2026-12-14",
          position: 1,
          slot_time: "12:30",
          item_type: "food",
          food_id: FOOD_ID,
          grams: 60,
          portion_id: null,
          nutrients: { kcal: 150 },
          snapshot: { name: "stub food" },
        },
        {
          local_date: "2026-12-15",
          position: 0,
          slot_time: "07:30",
          item_type: "recipe",
          recipe_id: RECIPE_ID,
          servings: 1,
          nutrients: { kcal: 400 },
          snapshot: { name: "stub recipe" },
          leftover_of_day: "2026-12-14",
          leftover_of_position: 0,
        },
      ],
    });
  });

  it("should refuse a plan with no days without sending anything", async () => {
    const error = await errorThrownBy(() =>
      saveMealPlan(createTestClient(), planInput({ days: [], items: [] })),
    );

    expect(error.message).toContain("Could not save your meal plan");
    expect(error.message).toContain("days");
    expect(recorded).toHaveLength(0);
  });

  it("should refuse a plan of more than 7 days without sending anything", async () => {
    const days = Array.from({ length: 8 }, (_, index) => ({
      localDate: `2026-12-${String(14 + index).padStart(2, "0")}`,
      target: {},
    }));

    const error = await errorThrownBy(() =>
      saveMealPlan(createTestClient(), planInput({ days, items: [] })),
    );

    expect(error.message).toContain("days");
    expect(recorded).toHaveLength(0);
  });

  it("should refuse an item whose amount is not above zero, naming the path and not the value", async () => {
    const error = await errorThrownBy(() =>
      saveMealPlan(
        createTestClient(),
        planInput({ items: [{ localDate: "2026-12-14", ...foodItem({ grams: 0 }) }] }),
      ),
    );

    expect(error.message).toContain("items.0.grams");
    expect(recorded).toHaveLength(0);
  });

  it("should refuse an item for a date that is not one of the days", async () => {
    const error = await errorThrownBy(() =>
      saveMealPlan(
        createTestClient(),
        planInput({ items: [{ localDate: "2026-12-30", ...foodItem() }] }),
      ),
    );

    expect(error.message).toContain("items.0.localDate");
    expect(recorded).toHaveLength(0);
  });

  it("should fail with the action and the code only when the database quotes the row", async () => {
    answer("post", "rpc/save_meal_plan", () => databaseErrorQuotingTheRow("22023"));

    const error = await errorThrownBy(() => saveMealPlan(createTestClient(), planInput()));

    expectOnlyTheCode(error, "save your meal plan", "22023");
  });
});

describe("replaceMealPlanDay", () => {
  it("should send the day's new items to replace_meal_plan_day", async () => {
    answer("post", "rpc/replace_meal_plan_day", () => new HttpResponse(null, { status: 204 }));

    await replaceMealPlanDay(createTestClient(), FIRST_DAY_ID, [foodItem({ position: 0 })]);

    expect(recorded[0]?.body).toStrictEqual({
      p_day_id: FIRST_DAY_ID,
      p_items: [
        {
          position: 0,
          slot_time: "12:30",
          item_type: "food",
          food_id: FOOD_ID,
          grams: 60,
          portion_id: null,
          nutrients: { kcal: 150 },
          snapshot: { name: "stub food" },
        },
      ],
    });
  });

  it("should fail with the action and the code only when the database refuses a confirmed day", async () => {
    answer("post", "rpc/replace_meal_plan_day", () => databaseErrorQuotingTheRow("22023"));

    const error = await errorThrownBy(() =>
      replaceMealPlanDay(createTestClient(), FIRST_DAY_ID, [foodItem()]),
    );

    expectOnlyTheCode(error, "replace this day of your meal plan", "22023");
  });
});

describe("confirmMealPlanDay", () => {
  const food = buildFood({ id: FOOD_ID, name: "Stub oats", kcal: 380 });
  const at = (time: string) => `2026-12-14T${time}:00.000Z`;

  it("should send the entries core built, a millisecond apart when they share a time, and resolve to the new ids", async () => {
    answer("post", "rpc/confirm_meal_plan_day", () =>
      HttpResponse.json([ENTRY_ID, OTHER_ENTRY_ID]),
    );

    const ids = await confirmMealPlanDay(createTestClient(), FIRST_DAY_ID, [
      {
        kind: "food",
        input: { food, quantity: 50, unit: "g", loggedAt: at("08:00"), localDate: "2026-12-14" },
      },
      {
        kind: "food",
        input: { food, quantity: 70, unit: "g", loggedAt: at("08:00"), localDate: "2026-12-14" },
      },
    ]);

    expect(ids).toStrictEqual([ENTRY_ID, OTHER_ENTRY_ID]);
    expect(recorded[0]?.body).toMatchObject({
      p_day_id: FIRST_DAY_ID,
      p_entries: [
        {
          local_date: "2026-12-14",
          logged_at: "2026-12-14T08:00:00.000Z",
          item_type: "food",
          food_id: FOOD_ID,
          quantity: 50,
          unit: "g",
          resolved_grams: 50,
          snapshot: { name: "Stub oats" },
          nutrients: { kcal: 190 },
        },
        { logged_at: "2026-12-14T08:00:00.001Z", quantity: 70, resolved_grams: 70 },
      ],
    });
  });

  it("should refuse an empty day without sending anything", async () => {
    const error = await errorThrownBy(() =>
      confirmMealPlanDay(createTestClient(), FIRST_DAY_ID, []),
    );

    expect(error).toBeInstanceOf(RangeError);
    expect(error.message).toBe("Could not confirm this day: there is nothing to log");
    expect(recorded).toHaveLength(0);
  });

  it("should refuse an amount below zero without sending anything and without quoting it", async () => {
    const error = await errorThrownBy(() =>
      confirmMealPlanDay(createTestClient(), FIRST_DAY_ID, [
        {
          kind: "food",
          input: { food, quantity: -5, unit: "g", loggedAt: at("08:00"), localDate: "2026-12-14" },
        },
      ]),
    );

    expect(error).toBeInstanceOf(RangeError);
    expect(error.message).not.toContain("-5");
    expect(recorded).toHaveLength(0);
  });

  it("should fail with the action and the code only when the database refuses", async () => {
    answer("post", "rpc/confirm_meal_plan_day", () => databaseErrorQuotingTheRow("22023"));

    const error = await errorThrownBy(() =>
      confirmMealPlanDay(createTestClient(), FIRST_DAY_ID, [
        {
          kind: "food",
          input: { food, quantity: 50, unit: "g", loggedAt: at("08:00"), localDate: "2026-12-14" },
        },
      ]),
    );

    expectOnlyTheCode(error, "confirm this day", "22023");
  });

  it("should fail when the database answers with a different number of ids", async () => {
    answer("post", "rpc/confirm_meal_plan_day", () => HttpResponse.json([ENTRY_ID]));

    const error = await errorThrownBy(() =>
      confirmMealPlanDay(createTestClient(), FIRST_DAY_ID, [
        {
          kind: "food",
          input: { food, quantity: 50, unit: "g", loggedAt: at("08:00"), localDate: "2026-12-14" },
        },
        {
          kind: "food",
          input: { food, quantity: 60, unit: "g", loggedAt: at("09:00"), localDate: "2026-12-14" },
        },
      ]),
    );

    expect(error.message).toBe(
      "Could not confirm this day: the database stored a different number of entries",
    );
  });
});

describe("archiveMealPlan", () => {
  it("should set archived_at on the plan", async () => {
    answer("patch", "meal_plans", (request) => postgrestRows(request, [{ id: PLAN_ID }]));

    await archiveMealPlan(createTestClient(), PLAN_ID);

    expect(
      z.strictObject({ archived_at: z.iso.datetime() }).safeParse(recorded[0]?.body).success,
    ).toBe(true);
    expect(recorded[0]?.url.searchParams.get("id")).toBe(`eq.${PLAN_ID}`);
  });

  it("should throw when no plan was changed", async () => {
    answer("patch", "meal_plans", (request) => postgrestRows(request, []));

    const error = await errorThrownBy(() => archiveMealPlan(createTestClient(), PLAN_ID));

    expect(error.message).toBe("Could not remove your meal plan: no plan was changed");
  });

  it("should fail with the action and the code only when the database quotes the row", async () => {
    answer("patch", "meal_plans", () => databaseErrorQuotingTheRow("42501"));

    const error = await errorThrownBy(() => archiveMealPlan(createTestClient(), PLAN_ID));

    expectOnlyTheCode(error, "remove your meal plan", "42501");
  });
});

describe("restoreMealPlan", () => {
  it("should clear archived_at on the plan", async () => {
    answer("patch", "meal_plans", (request) => postgrestRows(request, [{ id: PLAN_ID }]));

    await restoreMealPlan(createTestClient(), PLAN_ID);

    expect(recorded[0]?.body).toEqual({ archived_at: null });
    expect(recorded[0]?.url.searchParams.get("id")).toBe(`eq.${PLAN_ID}`);
  });

  it("should throw when no plan was changed", async () => {
    answer("patch", "meal_plans", (request) => postgrestRows(request, []));

    const error = await errorThrownBy(() => restoreMealPlan(createTestClient(), PLAN_ID));

    expect(error.message).toBe("Could not bring back your meal plan: no plan was changed");
  });

  it("should fail with the action and the code only when the database quotes the row", async () => {
    answer("patch", "meal_plans", () => databaseErrorQuotingTheRow("42501"));

    const error = await errorThrownBy(() => restoreMealPlan(createTestClient(), PLAN_ID));

    expectOnlyTheCode(error, "bring back your meal plan", "42501");
  });
});
