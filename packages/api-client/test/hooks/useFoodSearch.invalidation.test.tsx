import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useCreateFood } from "../../src/hooks/useCreateFood";
import { useFoodSearch } from "../../src/hooks/useFoodSearch";
import {
  AUTH_USER_URL,
  REST_URL,
  SIGNED_IN_USER_ID,
  foodRow,
  portionRow,
  postgrestRows,
  signInAs,
} from "../support/postgrest";
import { OFF_SEARCH_URL, SEARCH_FOODS_URL, offCandidate, searchHitRows } from "../support/search";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

let searchFoodsCalls = 0;
let offSearchCalls = 0;

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  searchFoodsCalls = 0;
  offSearchCalls = 0;
  server.use(
    http.get(AUTH_USER_URL, () =>
      HttpResponse.json({ id: SIGNED_IN_USER_ID, aud: "authenticated", role: "authenticated" }),
    ),
    http.post(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, [foodRow()], 201)),
    http.post(`${REST_URL}/food_portions`, ({ request }) =>
      postgrestRows(request, [portionRow()], 201),
    ),
    http.post(SEARCH_FOODS_URL, () => {
      searchFoodsCalls += 1;
      return HttpResponse.json(searchHitRows(2));
    }),
    http.post(OFF_SEARCH_URL, () => {
      offSearchCalls += 1;
      return HttpResponse.json({ candidates: [offCandidate()] });
    }),
  );
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const validInput = {
  name: "Protein flapjack",
  basis: "per_100g",
  kcal: 410,
  protein_g: 22,
  fat_g: 14,
  carbs_g: 45,
  portions: [{ label: "1 bar", grams: 60, isDefault: true }],
};

describe("saving a food while a search is on screen", () => {
  it("should refresh the local search but not spend another Open Food Facts search", async () => {
    const { client, wrapper } = createWrapper();
    await signInAs(client, SIGNED_IN_USER_ID);
    const { result } = renderHook(
      () => ({ search: useFoodSearch("chicken"), create: useCreateFood() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.search.off).toHaveLength(1);
    });
    expect(searchFoodsCalls).toBe(1);
    expect(offSearchCalls).toBe(1);

    await act(() => result.current.create.mutateAsync(validInput));

    await waitFor(() => {
      expect(searchFoodsCalls).toBe(2);
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
    expect(offSearchCalls).toBe(1);
    expect(result.current.search.off).toEqual([offCandidate()]);
  });
});
