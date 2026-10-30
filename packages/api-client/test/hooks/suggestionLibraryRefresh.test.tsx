import { act, renderHook } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useArchiveExercise } from "../../src/hooks/useArchiveExercise";
import { useSaveExercise } from "../../src/hooks/useSaveExercise";
import { keys } from "../../src/queryKeys";
import { OWN_EXERCISE_ID, exerciseRow, installExercisesFake } from "../support/exercises";
import { createWrapper } from "../support/wrapper";

import type { QueryClient } from "@tanstack/react-query";

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

// The suggestion library is the exercises the suggestion chooses from, so an exercise saved or archived
// changes it. It is read once for the session, so the write is what refreshes it.

const LIBRARY_KEYS = [
  keys.training.suggestionLibrary("barbell,dumbbell"),
  keys.training.suggestionLibrary("cable"),
];

const seed = (queryClient: QueryClient) => {
  for (const queryKey of [...LIBRARY_KEYS, keys.training.sets("2026-10-02")]) {
    queryClient.setQueryData(queryKey, []);
  }
  const isStale = (queryKey: readonly unknown[]) =>
    queryClient.getQueryState(queryKey)?.isInvalidated === true;
  return { isStale };
};

describe("the suggestion library after an exercise is written", () => {
  it("should mark the library of every equipment list stale after an exercise is saved, and no logged set", async () => {
    installExercisesFake(server, { rows: [exerciseRow()] });
    const { queryClient, wrapper } = createWrapper();
    const { isStale } = seed(queryClient);
    const { result } = renderHook(() => useSaveExercise(), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        draft: {
          name: "Cable raise",
          equipment: "cable",
          muscles: [{ muscle_id: "delt_side", role: "primary" }],
        },
      }),
    );

    for (const queryKey of LIBRARY_KEYS) {
      expect(isStale(queryKey)).toBe(true);
    }
    expect(isStale(keys.training.sets("2026-10-02"))).toBe(false);
  });

  it("should mark the library stale after an exercise is archived, since an archived exercise is not suggested", async () => {
    installExercisesFake(server);
    const { queryClient, wrapper } = createWrapper();
    const { isStale } = seed(queryClient);
    const { result } = renderHook(() => useArchiveExercise(), { wrapper });

    await act(() => result.current.mutateAsync(OWN_EXERCISE_ID));

    for (const queryKey of LIBRARY_KEYS) {
      expect(isStale(queryKey)).toBe(true);
    }
    expect(isStale(keys.training.sets("2026-10-02"))).toBe(false);
  });
});
