import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  MEAL_PLAN_REPEAT_LIMIT_MAX,
  getMealPlanRepeatLimit,
  setMealPlanRepeatLimit,
} from "../../src/repos/mealPlanRepeatLimit";
import { createTestClient } from "../createTestClient";
import { REST_URL, SIGNED_IN_USER_ID, postgrestRows } from "../support/postgrest";
import {
  databaseErrorQuotingTheRow,
  errorThrownBy,
  expectOnlyTheCode,
} from "../support/quotedDatabaseError";

type Recorded = { url: URL; body: unknown };

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

const answer = (method: "get" | "patch", respond: (request: Request) => Response) => {
  server.use(
    http[method](`${REST_URL}/profiles`, async ({ request }) => {
      const text = await request.clone().text();
      recorded.push({ url: new URL(request.url), body: text === "" ? null : JSON.parse(text) });
      return respond(request);
    }),
  );
};

describe("getMealPlanRepeatLimit", () => {
  it("should read the limit the person chose, 0 for no limit", async () => {
    answer("get", (request) => postgrestRows(request, [{ meal_plan_repeat_limit: 0 }]));

    expect(await getMealPlanRepeatLimit(createTestClient())).toBe(0);
    expect(recorded[0]?.url.searchParams.get("select")).toBe("meal_plan_repeat_limit");
  });

  it("should read null when the person has not chosen", async () => {
    answer("get", (request) => postgrestRows(request, [{ meal_plan_repeat_limit: null }]));

    expect(await getMealPlanRepeatLimit(createTestClient())).toBeNull();
  });

  it("should read null when there is no profile row", async () => {
    answer("get", (request) => postgrestRows(request, []));

    expect(await getMealPlanRepeatLimit(createTestClient())).toBeNull();
  });

  it("should fail with the action and the code only", async () => {
    answer("get", () => databaseErrorQuotingTheRow("42501"));

    const error = await errorThrownBy(() => getMealPlanRepeatLimit(createTestClient()));

    expectOnlyTheCode(error, "load your repeat limit", "42501");
  });
});

describe("setMealPlanRepeatLimit", () => {
  it("should state the largest limit, 7, as the database does", () => {
    expect(MEAL_PLAN_REPEAT_LIMIT_MAX).toBe(7);
  });

  it.each([0, 1, 7, null])("should write %s to the person's own profile", async (limit) => {
    answer("patch", (request) => postgrestRows(request, [{ id: SIGNED_IN_USER_ID }]));

    await setMealPlanRepeatLimit(createTestClient(), SIGNED_IN_USER_ID, limit);

    expect(recorded[0]?.body).toStrictEqual({ meal_plan_repeat_limit: limit });
    expect(recorded[0]?.url.searchParams.get("id")).toBe(`eq.${SIGNED_IN_USER_ID}`);
  });

  it.each([-1, 8, 1.5, Number.NaN])("should refuse %s without sending anything", async (limit) => {
    const error = await errorThrownBy(() =>
      setMealPlanRepeatLimit(createTestClient(), SIGNED_IN_USER_ID, limit),
    );

    expect(error.message).toBe("Could not save your repeat limit (invalid)");
    expect(recorded).toHaveLength(0);
  });

  it("should throw when no profile was changed", async () => {
    answer("patch", (request) => postgrestRows(request, []));

    const error = await errorThrownBy(() =>
      setMealPlanRepeatLimit(createTestClient(), SIGNED_IN_USER_ID, 2),
    );

    expect(error.message).toBe("Could not save your repeat limit: no profile was changed");
  });

  it("should fail with the action and the code only when the database quotes the row", async () => {
    answer("patch", () => databaseErrorQuotingTheRow("23514"));

    const error = await errorThrownBy(() =>
      setMealPlanRepeatLimit(createTestClient(), SIGNED_IN_USER_ID, 2),
    );

    expectOnlyTheCode(error, "save your repeat limit", "23514");
  });
});
