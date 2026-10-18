import { act, renderHook } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useSetActiveRoutine } from "../../src/hooks/useSetActiveRoutine";
import {
  OTHER_ROUTINE_ID,
  ROUTINE_ID,
  installRoutinesFake,
  routineDetailRow,
  seedTrainingQueries,
} from "../support/routines";
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

describe("useSetActiveRoutine", () => {
  it("should make the routine active and resolve to it as stored", async () => {
    const fake = installRoutinesFake(server, {
      routines: [routineDetailRow({ is_active: true, activated_at: "2026-10-18T09:00:00+00:00" })],
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSetActiveRoutine(), { wrapper });

    const routine = await act(() => result.current.mutateAsync(ROUTINE_ID));

    expect(fake.activations).toEqual([{ p_routine_id: ROUTINE_ID }]);
    expect(routine).toMatchObject({ id: ROUTINE_ID, is_active: true });
  });

  it("should clear the active routine with null", async () => {
    const fake = installRoutinesFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSetActiveRoutine(), { wrapper });

    const routine = await act(() => result.current.mutateAsync(null));

    expect(fake.activations).toEqual([{ p_routine_id: null }]);
    expect(routine).toBeNull();
  });

  it("should mark every training family stale, since the plan changed", async () => {
    installRoutinesFake(server, { routines: [routineDetailRow({ is_active: true })] });
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedTrainingQueries(queryClient);
    const { result } = renderHook(() => useSetActiveRoutine(), { wrapper });

    await act(() => result.current.mutateAsync(ROUTINE_ID));

    for (const queryKey of Object.values(seeded.queryKeys)) {
      expect(seeded.isStale(queryKey)).toBe(true);
    }
  });

  it("should mark every training family stale when clearing too", async () => {
    installRoutinesFake(server);
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedTrainingQueries(queryClient);
    const { result } = renderHook(() => useSetActiveRoutine(), { wrapper });

    await act(() => result.current.mutateAsync(null));

    for (const queryKey of Object.values(seeded.queryKeys)) {
      expect(seeded.isStale(queryKey)).toBe(true);
    }
  });

  it("should not run a second request for a second press with the same routine", async () => {
    const fake = installRoutinesFake(server, { routines: [routineDetailRow({ is_active: true })] });
    const release = fake.holdWrites();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSetActiveRoutine(), { wrapper });

    await act(async () => {
      const first = result.current.mutateAsync(ROUTINE_ID);
      const second = result.current.mutateAsync(ROUTINE_ID);
      await new Promise((resolve) => setTimeout(resolve, 50));
      release();
      await Promise.all([first, second]);
    });

    expect(fake.activations).toHaveLength(1);
  });

  it("should still mark the training families stale when the call fails, naming the action and the code only", async () => {
    const fake = installRoutinesFake(server);
    fake.failWith("22023");
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedTrainingQueries(queryClient);
    const { result } = renderHook(() => useSetActiveRoutine(), { wrapper });

    const failure = await act(() =>
      result.current.mutateAsync(OTHER_ROUTINE_ID).catch((error: unknown) => error),
    );

    expect(failure).toMatchObject({ message: "Could not make the routine active (22023)" });
    expect(seeded.isStale(seeded.queryKeys.activeRoutine)).toBe(true);
  });
});
