import { act, renderHook } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useArchiveExercise } from "../../src/hooks/useArchiveExercise";
import {
  OWN_EXERCISE_ID,
  installExercisesFake,
  seedExerciseAndTrainingQueries,
} from "../support/exercises";
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

describe("useArchiveExercise", () => {
  it("should archive the exercise", async () => {
    const fake = installExercisesFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useArchiveExercise(), { wrapper });

    await act(() => result.current.mutateAsync(OWN_EXERCISE_ID));

    expect(fake.archives).toHaveLength(1);
  });

  it("should mark every exercise search and the archived exercise stale, and no logged set, session, routine or plan", async () => {
    installExercisesFake(server);
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedExerciseAndTrainingQueries(queryClient);
    const { result } = renderHook(() => useArchiveExercise(), { wrapper });

    await act(() => result.current.mutateAsync(OWN_EXERCISE_ID));

    expect(seeded.isStale(seeded.queryKeys.exerciseSearch)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.otherExerciseSearch)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.exercise)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.otherExercise)).toBe(false);
    for (const queryKey of Object.values(seeded.trainingKeys)) {
      expect(seeded.isStale(queryKey)).toBe(false);
    }
  });

  it("should refresh also after a failure", async () => {
    const fake = installExercisesFake(server);
    fake.failArchiveWith("XX000");
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedExerciseAndTrainingQueries(queryClient);
    const { result } = renderHook(() => useArchiveExercise(), { wrapper });

    await act(() => result.current.mutateAsync(OWN_EXERCISE_ID).catch(() => null));

    expect(seeded.isStale(seeded.queryKeys.exercise)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.exerciseSearch)).toBe(true);
  });

  it("should not run a second request for a second press with the same id", async () => {
    const fake = installExercisesFake(server);
    const release = fake.holdWrites();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useArchiveExercise(), { wrapper });

    await act(async () => {
      const first = result.current.mutateAsync(OWN_EXERCISE_ID);
      const second = result.current.mutateAsync(OWN_EXERCISE_ID);
      await new Promise((resolve) => setTimeout(resolve, 50));
      release();
      await Promise.all([first, second]);
    });

    expect(fake.archives).toHaveLength(1);
  });

  it("should throw a RangeError before any request when the id is not a UUID", async () => {
    const fake = installExercisesFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useArchiveExercise(), { wrapper });

    const failure = await act(() =>
      result.current.mutateAsync("not-a-uuid").catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(RangeError);
    expect(fake.requestCount).toBe(0);
  });
});
