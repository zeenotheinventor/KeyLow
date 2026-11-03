import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { FavouriteRuleError } from "../../src/errors";
import {
  addFavouriteFood,
  listFavouriteFoods,
  removeFavouriteFood,
} from "../../src/repos/favourites";
import { createTestClient } from "../createTestClient";
import { REST_URL, foodRow, postgrestError, postgrestRows } from "../support/postgrest";

const FOOD_ID = foodRow().id;
const OTHER_FOOD_ID = "66666666-6666-4666-8666-666666666666";

type Recorded = { url: URL; method: string; headers: Headers; body: unknown };

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

async function record(request: Request) {
  const text = await request.clone().text();
  recorded.push({
    url: new URL(request.url),
    method: request.method,
    headers: request.headers,
    body: text === "" ? null : JSON.parse(text),
  });
}

const favouriteRow = (overrides: { created_at?: string; foods?: unknown } = {}) => ({
  created_at: "2026-11-03T09:00:00.123456+00:00",
  foods: foodRow(),
  ...overrides,
});

describe("listFavouriteFoods", () => {
  it("should return each favourite with its food, as the database ordered them", async () => {
    const toast = foodRow({ id: OTHER_FOOD_ID, name: "Toast" });
    server.use(
      http.get(`${REST_URL}/food_favourites`, ({ request }) => {
        void record(request);
        return postgrestRows(request, [
          favouriteRow({ created_at: "2026-11-03T10:00:00+00:00", foods: toast }),
          favouriteRow(),
        ]);
      }),
    );

    const favourites = await listFavouriteFoods(createTestClient());

    expect(favourites.map((favourite) => [favourite.foodId, favourite.createdAt])).toEqual([
      [OTHER_FOOD_ID, "2026-11-03T10:00:00+00:00"],
      [FOOD_ID, "2026-11-03T09:00:00.123456+00:00"],
    ]);
    expect(favourites[0]?.food).toEqual(toast);
  });

  it("should join foods inner, leave out deleted foods and ask for the newest first", async () => {
    server.use(
      http.get(`${REST_URL}/food_favourites`, ({ request }) => {
        void record(request);
        return postgrestRows(request, []);
      }),
    );

    await listFavouriteFoods(createTestClient());

    const { searchParams } = recorded[0]?.url ?? new URL("http://unset");
    expect(searchParams.get("select")).toMatch(/foods!inner\(/);
    expect(searchParams.get("foods.deleted_at")).toBe("is.null");
    expect(searchParams.get("order")).toBe("created_at.desc,food_id.desc");
  });

  it("should name the action and the code only when the read fails", async () => {
    server.use(
      http.get(`${REST_URL}/food_favourites`, () =>
        postgrestError(500, "XX000", "secret oats detail"),
      ),
    );

    const failure = await listFavouriteFoods(createTestClient()).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure).toHaveProperty("message", "Could not load the favourite foods (XX000)");
    expect(failure).toHaveProperty("cause", { code: "XX000" });
  });

  it("should report a row that does not parse without quoting it", async () => {
    server.use(
      http.get(`${REST_URL}/food_favourites`, ({ request }) =>
        postgrestRows(request, [favouriteRow({ foods: { name: "secret oats" } })]),
      ),
    );

    const failure = await listFavouriteFoods(createTestClient()).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).not.toContain("secret oats");
  });
});

describe("addFavouriteFood", () => {
  const answerCreated = (response?: () => Response) => {
    server.use(
      http.post(`${REST_URL}/food_favourites`, async ({ request }) => {
        await record(request);
        return response?.() ?? new Response(null, { status: 201 });
      }),
    );
  };

  it("should insert the food and ignore a duplicate, so favouriting twice is not an error", async () => {
    answerCreated();

    await addFavouriteFood(createTestClient(), FOOD_ID);

    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.body).toEqual({ food_id: FOOD_ID });
    expect(recorded[0]?.url.searchParams.get("on_conflict")).toBe("owner_id,food_id");
    expect(recorded[0]?.headers.get("prefer")).toContain("resolution=ignore-duplicates");
  });

  it("should throw a FavouriteRuleError with the rule favourite_limit when the cap is reached", async () => {
    answerCreated(() => postgrestError(400, "KL004", "favourite_limit"));

    const failure = await addFavouriteFood(createTestClient(), FOOD_ID).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(FavouriteRuleError);
    expect(failure).toHaveProperty("rule", "favourite_limit");
    expect(failure).toHaveProperty("message", "Could not favourite the food (favourite_limit)");
  });

  it("should name the action and the code only for any other failure", async () => {
    answerCreated(() => postgrestError(403, "42501", "row violates secret oats policy"));

    const failure = await addFavouriteFood(createTestClient(), FOOD_ID).catch(
      (error: unknown) => error,
    );

    expect(failure).not.toBeInstanceOf(FavouriteRuleError);
    expect(failure).toHaveProperty("message", "Could not favourite the food (42501)");
    expect(failure).toHaveProperty("cause", { code: "42501" });
  });
});

describe("removeFavouriteFood", () => {
  it("should delete the favourite of this food", async () => {
    server.use(
      http.delete(`${REST_URL}/food_favourites`, async ({ request }) => {
        await record(request);
        return new Response(null, { status: 204 });
      }),
    );

    await removeFavouriteFood(createTestClient(), FOOD_ID);

    expect(recorded[0]?.url.searchParams.get("food_id")).toBe(`eq.${FOOD_ID}`);
  });

  it("should name the action and the code only when the delete fails", async () => {
    server.use(
      http.delete(`${REST_URL}/food_favourites`, () =>
        postgrestError(500, "XX000", "secret oats detail"),
      ),
    );

    const failure = await removeFavouriteFood(createTestClient(), FOOD_ID).catch(
      (error: unknown) => error,
    );

    expect(failure).toHaveProperty("message", "Could not unfavourite the food (XX000)");
    expect(failure).toHaveProperty("cause", { code: "XX000" });
  });
});
