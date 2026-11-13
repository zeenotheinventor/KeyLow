import { renderHook } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useFoodsWithPortionsLoader } from "../../src/hooks/useFoodsWithPortionsLoader";
import { REST_URL, foodRow, portionRow, postgrestError, postgrestRows } from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

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

const FIRST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECOND_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// The food lookup asks for one row by its id, and the portions for the rows of one food.
const answerFoods = (foods: Record<string, ReturnType<typeof foodRow> | null>) => {
  server.use(
    http.get(`${REST_URL}/foods`, ({ request }) => {
      const id = new URL(request.url).searchParams.get("id")?.replace("eq.", "") ?? "";
      const found = foods[id];
      return postgrestRows(request, found === null || found === undefined ? [] : [found]);
    }),
    http.get(`${REST_URL}/food_portions`, ({ request }) => {
      const id = new URL(request.url).searchParams.get("food_id")?.replace("eq.", "") ?? "";
      return postgrestRows(request, [portionRow({ food_id: id })]);
    }),
  );
};

describe("useFoodsWithPortionsLoader", () => {
  it("should load each food with its portions, by id", async () => {
    answerFoods({
      [FIRST_ID]: foodRow({ id: FIRST_ID, name: "First" }),
      [SECOND_ID]: foodRow({ id: SECOND_ID, name: "Second" }),
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useFoodsWithPortionsLoader(), { wrapper });

    const loaded = await result.current([FIRST_ID, SECOND_ID, FIRST_ID]);

    expect([...loaded.keys()]).toEqual([FIRST_ID, SECOND_ID]);
    expect(loaded.get(FIRST_ID)?.food.name).toBe("First");
    expect(loaded.get(SECOND_ID)?.portions).toHaveLength(1);
  });

  it("should leave a food that is not visible out, so the caller can tell", async () => {
    answerFoods({ [FIRST_ID]: foodRow({ id: FIRST_ID }), [SECOND_ID]: null });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useFoodsWithPortionsLoader(), { wrapper });

    const loaded = await result.current([FIRST_ID, SECOND_ID]);

    expect([...loaded.keys()]).toEqual([FIRST_ID]);
  });

  it("should reject when a lookup fails, so a recipe is never opened short", async () => {
    server.use(
      http.get(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "food unavailable")),
      http.get(`${REST_URL}/food_portions`, ({ request }) => postgrestRows(request, [])),
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useFoodsWithPortionsLoader(), { wrapper });

    await expect(result.current([FIRST_ID])).rejects.toThrow();
  });
});
