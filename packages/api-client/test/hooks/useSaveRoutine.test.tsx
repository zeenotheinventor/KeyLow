import { act, renderHook } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useSaveRoutine } from "../../src/hooks/useSaveRoutine";
import { keys } from "../../src/queryKeys";
import {
  DAY_ID,
  EXERCISE_ID,
  RECOGNISABLE_ROUTINE_NAME,
  ROUTINE_ID,
  installRoutinesFake,
  routineDetailRow,
  seedTrainingQueries,
} from "../support/routines";
import { createWrapper } from "../support/wrapper";

import type { RoutineSave } from "../../src/repos/routineWrites";

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

const save = (name = RECOGNISABLE_ROUTINE_NAME): RoutineSave => ({
  id: null,
  draft: {
    name,
    days: [
      {
        id: DAY_ID,
        weekday: 0,
        name: "Push",
        exercises: [
          { exercise_id: EXERCISE_ID, target_sets: 3, rep_min: 8, rep_max: 12, target_rir: null },
        ],
      },
    ],
  },
});

describe("useSaveRoutine", () => {
  it("should save in a single request and resolve to the routine as stored", async () => {
    const fake = installRoutinesFake(server, { routines: [routineDetailRow()] });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveRoutine(), { wrapper });

    const saved = await act(() => result.current.mutateAsync(save()));

    expect(fake.saves).toHaveLength(1);
    expect(saved).toMatchObject({ id: ROUTINE_ID, name: RECOGNISABLE_ROUTINE_NAME });
  });

  it("should put the stored routine in the cache of its own screen", async () => {
    installRoutinesFake(server, { routines: [routineDetailRow({ name: "As stored" })] });
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveRoutine(), { wrapper });

    await act(() => result.current.mutateAsync(save()));

    expect(queryClient.getQueryData(keys.training.routine(ROUTINE_ID))).toMatchObject({
      id: ROUTINE_ID,
      name: "As stored",
    });
  });

  it("should mark the routine library and every routine stale, and nothing of the plan, for a routine that is not active", async () => {
    installRoutinesFake(server, { routines: [routineDetailRow()] });
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedTrainingQueries(queryClient);
    const { result } = renderHook(() => useSaveRoutine(), { wrapper });

    await act(() => result.current.mutateAsync(save()));

    expect(seeded.isStale(seeded.queryKeys.routines)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.routine)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.activeRoutine)).toBe(false);
    expect(seeded.isStale(seeded.queryKeys.weekSessions)).toBe(false);
    expect(seeded.isStale(seeded.queryKeys.sets)).toBe(false);
  });

  it("should mark every training family stale when the saved routine is the active one, since the plan changed", async () => {
    installRoutinesFake(server, { routines: [routineDetailRow({ is_active: true })] });
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedTrainingQueries(queryClient);
    const { result } = renderHook(() => useSaveRoutine(), { wrapper });

    await act(() => result.current.mutateAsync(save()));

    for (const queryKey of Object.values(seeded.queryKeys)) {
      expect(seeded.isStale(queryKey)).toBe(true);
    }
  });

  it("should not run a second request for a second press of Save with the same input", async () => {
    const fake = installRoutinesFake(server, { routines: [routineDetailRow()] });
    const release = fake.holdWrites();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveRoutine(), { wrapper });

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    await act(async () => {
      first = result.current.mutateAsync(save());
      second = result.current.mutateAsync(save());
      await new Promise((resolve) => setTimeout(resolve, 50));
      release();
      await Promise.all([first, second]);
    });

    expect(fake.saves).toHaveLength(1);
  });

  it("should run a different edit after the pending save settles", async () => {
    const fake = installRoutinesFake(server, { routines: [routineDetailRow()] });
    const release = fake.holdWrites();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveRoutine(), { wrapper });

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
    const fake = installRoutinesFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveRoutine(), { wrapper });

    const failure = await act(() =>
      result.current.mutateAsync(save("  ")).catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(RangeError);
    expect(fake.requestCount).toBe(0);
  });

  it("should leave the plan alone and still mark the routines stale when the save fails", async () => {
    const fake = installRoutinesFake(server);
    fake.failWith("P0002");
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedTrainingQueries(queryClient);
    const { result } = renderHook(() => useSaveRoutine(), { wrapper });

    const failure = await act(() =>
      result.current.mutateAsync(save()).catch((error: unknown) => error),
    );

    expect(failure).toMatchObject({ message: "Could not save the routine (P0002)" });
    expect(seeded.isStale(seeded.queryKeys.routines)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.activeRoutine)).toBe(false);
  });
});
