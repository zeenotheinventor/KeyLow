import { act, renderHook } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ExerciseRuleError } from "../../src/errors";
import { useSaveExercise } from "../../src/hooks/useSaveExercise";
import { keys } from "../../src/queryKeys";
import {
  GLOBAL_EXERCISE_ID,
  OWN_EXERCISE_ID,
  RECOGNISABLE_EXERCISE_NAME,
  exerciseRow,
  globalExerciseRow,
  installExercisesFake,
  seedExerciseAndTrainingQueries,
} from "../support/exercises";
import { createWrapper } from "../support/wrapper";

import type { ExerciseSave } from "../../src/repos/exerciseWrites";

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

const save = (name = RECOGNISABLE_EXERCISE_NAME, id?: string): ExerciseSave => ({
  ...(id === undefined ? {} : { id }),
  draft: {
    name,
    equipment: "cable",
    muscles: [{ muscle_id: "delt_side", role: "primary" }],
  },
});

describe("useSaveExercise", () => {
  it("should save and resolve to the exercise as stored", async () => {
    const fake = installExercisesFake(server, { rows: [exerciseRow({ name: "As stored" })] });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveExercise(), { wrapper });

    const saved = await act(() => result.current.mutateAsync(save()));

    expect(fake.saves).toHaveLength(1);
    expect(saved).toMatchObject({ id: OWN_EXERCISE_ID, name: "As stored" });
  });

  it("should put the stored exercise in the cache of its own screen", async () => {
    installExercisesFake(server, { rows: [exerciseRow({ name: "As stored" })] });
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveExercise(), { wrapper });

    await act(() => result.current.mutateAsync(save()));

    expect(queryClient.getQueryData(keys.training.exercise(OWN_EXERCISE_ID))).toMatchObject({
      id: OWN_EXERCISE_ID,
      name: "As stored",
    });
  });

  it("should mark every exercise search, the saved exercise, the active routine and every routine stale, since the plan shows the live name and map, and no logged set, session or other family", async () => {
    installExercisesFake(server, { rows: [exerciseRow()] });
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedExerciseAndTrainingQueries(queryClient);
    const { result } = renderHook(() => useSaveExercise(), { wrapper });

    await act(() => result.current.mutateAsync(save()));

    expect(seeded.isStale(seeded.queryKeys.exerciseSearch)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.otherExerciseSearch)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.exercise)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.otherExercise)).toBe(false);
    expect(seeded.isStale(seeded.trainingKeys.activeRoutine)).toBe(true);
    expect(seeded.isStale(seeded.trainingKeys.routine)).toBe(true);
    const others = Object.entries(seeded.trainingKeys)
      .filter(([name]) => name !== "activeRoutine" && name !== "routine")
      .map(([, queryKey]) => queryKey);
    expect(others).toHaveLength(6);
    for (const queryKey of others) {
      expect(seeded.isStale(queryKey)).toBe(false);
    }
  });

  it("should refresh the edited exercise also after a failure, and still no logged set", async () => {
    const fake = installExercisesFake(server, { rows: [exerciseRow()] });
    fake.failSaveWith("XX000");
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedExerciseAndTrainingQueries(queryClient);
    const { result } = renderHook(() => useSaveExercise(), { wrapper });

    await act(() => result.current.mutateAsync(save(undefined, OWN_EXERCISE_ID)).catch(() => null));

    expect(seeded.isStale(seeded.queryKeys.exercise)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.exerciseSearch)).toBe(true);
    expect(seeded.isStale(seeded.trainingKeys.sets)).toBe(false);
  });

  it("should not run a second request for a second press of Save with the same input", async () => {
    const fake = installExercisesFake(server, { rows: [exerciseRow()] });
    const release = fake.holdWrites();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveExercise(), { wrapper });

    await act(async () => {
      const first = result.current.mutateAsync(save());
      const second = result.current.mutateAsync(save());
      await new Promise((resolve) => setTimeout(resolve, 50));
      release();
      await Promise.all([first, second]);
    });

    expect(fake.saves).toHaveLength(1);
  });

  it("should run a different edit after the pending save settles", async () => {
    const fake = installExercisesFake(server, { rows: [exerciseRow()] });
    const release = fake.holdWrites();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveExercise(), { wrapper });

    await act(async () => {
      const first = result.current.mutateAsync(save("First"));
      const second = result.current.mutateAsync(save("Second"));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(fake.saves).toHaveLength(1);
      release();
      await Promise.all([first, second]);
    });

    expect(fake.saves).toHaveLength(2);
  });

  it("should throw a RangeError before any request for a draft the database would refuse", async () => {
    const fake = installExercisesFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveExercise(), { wrapper });

    const failure = await act(() =>
      result.current.mutateAsync(save("  ")).catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(RangeError);
    expect(fake.requestCount).toBe(0);
  });

  it("should throw the typed rule for a library exercise", async () => {
    const fake = installExercisesFake(server, { rows: [globalExerciseRow()] });
    fake.failSaveWith("P0002");
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveExercise(), { wrapper });

    const failure = await act(() =>
      result.current
        .mutateAsync(save(undefined, GLOBAL_EXERCISE_ID))
        .catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(ExerciseRuleError);
  });
});
