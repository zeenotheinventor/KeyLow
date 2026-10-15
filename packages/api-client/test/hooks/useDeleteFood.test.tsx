import { act, renderHook } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useDeleteFood } from "../../src/hooks/useDeleteFood";
import { keys } from "../../src/queryKeys";
import { REST_URL, foodRow, postgrestError, postgrestRows } from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

let patches: Array<{ body: unknown; id: string | null }> = [];

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  patches = [];
  server.use(
    http.patch(`${REST_URL}/foods`, async ({ request }) => {
      patches.push({
        body: await request.clone().json(),
        id: new URL(request.url).searchParams.get("id"),
      });
      return postgrestRows(request, [foodRow({ deleted_at: "2026-10-15T09:30:00+00:00" })]);
    }),
  );
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const FOOD_ID = foodRow().id;

function renderDeleteFood() {
  const rendered = createWrapper();
  const hook = renderHook(() => useDeleteFood(), { wrapper: rendered.wrapper });
  return { ...rendered, ...hook };
}

describe("useDeleteFood", () => {
  it("should soft delete the food with this id and resolve to it", async () => {
    const { result } = renderDeleteFood();

    const food = await act(() => result.current.mutateAsync(FOOD_ID));

    expect(food.deleted_at).not.toBeNull();
    expect(patches).toHaveLength(1);
    expect(patches[0]?.id).toBe(`eq.${FOOD_ID}`);
    expect(patches[0]?.body).toHaveProperty("deleted_at", expect.stringMatching(/^20\d\d-/));
  });

  it("should invalidate every foods query once, which covers the detail, portions, search and barcode keys", async () => {
    const { queryClient, result } = renderDeleteFood();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await act(() => result.current.mutateAsync(FOOD_ID));

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate.mock.calls[0]?.[0]).toHaveProperty("queryKey", keys.foods.all);
  });

  it("should leave the Open Food Facts searches alone", async () => {
    const { queryClient, result } = renderDeleteFood();
    queryClient.setQueryData(keys.foods.offSearch("flapjack"), []);
    queryClient.setQueryData(keys.foods.detail(FOOD_ID), foodRow());

    await act(() => result.current.mutateAsync(FOOD_ID));

    expect(queryClient.getQueryState(keys.foods.offSearch("flapjack"))?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(keys.foods.detail(FOOD_ID))?.isInvalidated).toBe(true);
  });

  it("should not invalidate anything when the delete fails", async () => {
    server.use(
      http.patch(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "database unavailable")),
    );
    const { queryClient, result } = renderDeleteFood();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await act(() => result.current.mutateAsync(FOOD_ID).catch(() => undefined));

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("should surface that the food was not found or cannot be deleted when no row changed", async () => {
    server.use(http.patch(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, [])));
    const { result } = renderDeleteFood();

    const failure = await act(() => result.current.mutateAsync(FOOD_ID).catch((e: unknown) => e));

    expect(failure).toHaveProperty(
      "message",
      expect.stringContaining("not found or cannot be deleted"),
    );
  });
});
