import { act, renderHook } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { RoutineRuleError } from "../../src/errors";
import { useArchiveRoutine } from "../../src/hooks/useArchiveRoutine";
import { keys } from "../../src/queryKeys";
import {
  ROUTINE_ID,
  installRoutinesFake,
  routineDetailRow,
  routineFlagsRow,
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

describe("useArchiveRoutine", () => {
  it("should archive the routine and resolve to it as stored", async () => {
    const fake = installRoutinesFake(server, { archived: routineFlagsRow({ is_archived: true }) });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useArchiveRoutine(), { wrapper });

    const routine = await act(() => result.current.mutateAsync({ id: ROUTINE_ID, archived: true }));

    expect(routine).toMatchObject({ id: ROUTINE_ID, is_archived: true });
    expect(fake.archives.map(({ body }) => body)).toEqual([{ is_archived: true }]);
  });

  it("should restore the routine with the same hook and archived false, which is the Undo", async () => {
    const fake = installRoutinesFake(server, { archived: routineFlagsRow() });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useArchiveRoutine(), { wrapper });

    await act(() => result.current.mutateAsync({ id: ROUTINE_ID, archived: true }));
    const restored = await act(() =>
      result.current.mutateAsync({ id: ROUTINE_ID, archived: false }),
    );

    expect(restored.is_archived).toBe(false);
    expect(fake.archives.map(({ body }) => body)).toEqual([
      { is_archived: true },
      { is_archived: false },
    ]);
  });

  it("should run an Undo tapped while the archive is on its way after it, so the last tap wins", async () => {
    const fake = installRoutinesFake(server, { archived: routineFlagsRow() });
    const release = fake.holdWrites();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useArchiveRoutine(), { wrapper });

    await act(async () => {
      const archive = result.current.mutateAsync({ id: ROUTINE_ID, archived: true });
      const undo = result.current.mutateAsync({ id: ROUTINE_ID, archived: false });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(fake.archives).toHaveLength(1);
      release();
      await Promise.all([archive, undo]);
    });

    expect(fake.archives.map(({ body }) => body)).toEqual([
      { is_archived: true },
      { is_archived: false },
    ]);
  });

  it("should mark the routines stale and leave the plan alone, since an archived routine was never the plan", async () => {
    installRoutinesFake(server, { archived: routineFlagsRow({ is_archived: true }) });
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedTrainingQueries(queryClient);
    queryClient.setQueryData(keys.training.routine(ROUTINE_ID), routineDetailRow());
    const { result } = renderHook(() => useArchiveRoutine(), { wrapper });

    await act(() => result.current.mutateAsync({ id: ROUTINE_ID, archived: true }));

    expect(seeded.isStale(seeded.queryKeys.routines)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.routine)).toBe(true);
    expect(queryClient.getQueryState(keys.training.routine(ROUTINE_ID))?.isInvalidated).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.activeRoutine)).toBe(false);
    expect(seeded.isStale(seeded.queryKeys.weekSessions)).toBe(false);
  });

  it("should refuse the active routine with the typed rule and leave the cache as it was", async () => {
    const fake = installRoutinesFake(server);
    fake.failWith(
      "23514",
      'new row for relation "routines" violates check constraint "routines_active_not_archived"',
    );
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedTrainingQueries(queryClient);
    const { result } = renderHook(() => useArchiveRoutine(), { wrapper });

    const failure = await act(() =>
      result.current
        .mutateAsync({ id: ROUTINE_ID, archived: true })
        .catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(RoutineRuleError);
    expect(failure).toMatchObject({ rule: "active_routine" });
    expect(seeded.isStale(seeded.queryKeys.activeRoutine)).toBe(false);
  });
});
