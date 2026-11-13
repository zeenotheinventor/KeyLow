import { act, renderHook } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { useAddPalatePreference } from "../../src/hooks/useAddPalatePreference";
import { useRemovePalatePreference } from "../../src/hooks/useRemovePalatePreference";
import { keys } from "../../src/queryKeys";
import { isDuplicatePalatePreference } from "../../src/repos/palatePreferences";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

const PREFERENCE_ID = "44444444-4444-4444-8444-444444444444";

const storedRow = {
  id: PREFERENCE_ID,
  kind: "allergy",
  food_id: null,
  recipe_id: null,
  label: "Peanuts",
};

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

describe("useAddPalatePreference", () => {
  it("should add the statement and resolve to the row as stored", async () => {
    server.use(
      http.post(`${REST_URL}/palate_preferences`, ({ request }) =>
        postgrestRows(request, [storedRow], 201),
      ),
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddPalatePreference(), { wrapper });

    const added = await act(() =>
      result.current.mutateAsync({ kind: "allergy", label: "Peanuts" }),
    );

    expect(added).toMatchObject({ id: PREFERENCE_ID, kind: "allergy", label: "Peanuts" });
  });

  it("should refresh the palate queries once the add is settled", async () => {
    server.use(
      http.post(`${REST_URL}/palate_preferences`, ({ request }) =>
        postgrestRows(request, [storedRow], 201),
      ),
    );
    const { queryClient, wrapper } = createWrapper();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAddPalatePreference(), { wrapper });

    await act(() => result.current.mutateAsync({ kind: "allergy", label: "Peanuts" }));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: keys.palate.all });
  });

  it("should fail with the code only when the same word is added twice, and still refresh", async () => {
    server.use(
      http.post(`${REST_URL}/palate_preferences`, () =>
        postgrestError(409, "23505", "duplicate key value violates unique constraint"),
      ),
    );
    const { queryClient, wrapper } = createWrapper();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAddPalatePreference(), { wrapper });

    const failure: unknown = await act(() =>
      result.current
        .mutateAsync({ kind: "dislike", label: "Peanuts" })
        .catch((error: unknown) => error),
    );

    expect(failure).toMatchObject({
      message: "Could not add to your palate (23505)",
      cause: { code: "23505" },
    });
    expect(isDuplicatePalatePreference(failure)).toBe(true);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: keys.palate.all });
  });
});

describe("useAddPalatePreference, pressed twice", () => {
  it("should send one request for a double press of the same word, and let both presses see its result", async () => {
    let posts = 0;
    server.use(
      http.post(`${REST_URL}/palate_preferences`, async ({ request }) => {
        posts += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return postgrestRows(request, [storedRow], 201);
      }),
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddPalatePreference(), { wrapper });

    const [first, second] = await act(() =>
      Promise.all([
        result.current.mutateAsync({ kind: "allergy", label: "Peanuts" }),
        result.current.mutateAsync({ kind: "allergy", label: "Peanuts" }),
      ]),
    );

    expect(posts).toBe(1);
    expect(first).toEqual(second);
  });

  it("should treat the same word in another case as the same press", async () => {
    let posts = 0;
    server.use(
      http.post(`${REST_URL}/palate_preferences`, async ({ request }) => {
        posts += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return postgrestRows(request, [storedRow], 201);
      }),
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddPalatePreference(), { wrapper });

    await act(() =>
      Promise.all([
        result.current.mutateAsync({ kind: "allergy", label: "Peanuts" }),
        result.current.mutateAsync({ kind: "allergy", label: " peanuts " }),
      ]),
    );

    expect(posts).toBe(1);
  });
});

describe("useRemovePalatePreference", () => {
  it("should call onError for every failed removal, not only the last", async () => {
    server.use(
      http.delete(`${REST_URL}/palate_preferences`, () =>
        postgrestError(500, "XX000", "internal error"),
      ),
    );
    const onError = vi.fn();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRemovePalatePreference({ onError }), { wrapper });

    await act(() =>
      Promise.allSettled([
        result.current.mutateAsync(PREFERENCE_ID),
        result.current.mutateAsync("44444444-4444-4444-8444-444444444445"),
      ]),
    );

    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("should delete the row by its id", async () => {
    const deleted: (string | null)[] = [];
    server.use(
      http.delete(`${REST_URL}/palate_preferences`, ({ request }) => {
        deleted.push(new URL(request.url).searchParams.get("id"));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRemovePalatePreference(), { wrapper });

    await act(() => result.current.mutateAsync(PREFERENCE_ID));

    expect(deleted).toEqual([`eq.${PREFERENCE_ID}`]);
  });

  it("should refresh the palate queries once the removal is settled", async () => {
    server.use(
      http.delete(`${REST_URL}/palate_preferences`, () => new HttpResponse(null, { status: 204 })),
    );
    const { queryClient, wrapper } = createWrapper();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useRemovePalatePreference(), { wrapper });

    await act(() => result.current.mutateAsync(PREFERENCE_ID));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: keys.palate.all });
  });
});
