import { TRAINING_PARAMS_V1, muscleState, targetedMuscles } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useMuscleState } from "../../src/hooks/useMuscleState";
import { keys } from "../../src/queryKeys";
import { getActiveRoutine, listSetsFrom } from "../../src/repos/training";
import { createTestClient } from "../createTestClient";
import {
  EXERCISE_ID,
  RECOGNISABLE_EXERCISE_NAME,
  installTrainingFake,
  routineRow,
  setRow,
  snapshotOf,
} from "../support/training";
import { createWrapper } from "../support/wrapper";

import type { TrainingSet } from "../../src";

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

// 13:00 on 17 October in London (BST), so the heat window starts on the local day 15 days earlier.
const NOW = "2026-10-17T12:00:00Z";
const START_DAY = "2026-10-02";
const SET_PERFORMED_AT = "2026-10-16T18:00:00+00:00";

const benchSet = (overrides: Record<string, unknown> = {}) =>
  setRow({ performed_at: SET_PERFORMED_AT, ...overrides });

const cachedSet: TrainingSet = {
  id: "99999999-9999-4999-8999-000000000001",
  session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  exercise_id: EXERCISE_ID,
  set_type: "working",
  rir: 2,
  rpe: null,
  performed_at: SET_PERFORMED_AT,
  snapshot: snapshotOf(),
  deleted_at: null,
};

describe("useMuscleState", () => {
  it("should give heat and volume for every muscle, with not_targeted for one the routine does not train", async () => {
    installTrainingFake(server, { sets: [benchSet()], routine: routineRow() });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMuscleState(NOW), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const state = result.current.data;
    expect(state?.lats).toMatchObject({ heat: 0, weeklySets: 0, volumeStatus: "not_targeted" });
    expect(state?.chest_lower).toMatchObject({ weeklySets: 1, volumeStatus: "under" });
    expect(state?.chest_lower.heat).toBeGreaterThan(0);
  });

  it("should give what core gives for the same rows (core is not the code under test here)", async () => {
    installTrainingFake(server, {
      sets: [benchSet(), benchSet({ performed_at: "2026-10-12T18:00:00+00:00" })],
      routine: routineRow(),
    });
    const { wrapper } = createWrapper();
    const client = createTestClient();

    const { result } = renderHook(() => useMuscleState(NOW), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const rows = await listSetsFrom(client, START_DAY, "2026-10-17");
    const routine = await getActiveRoutine(client);
    expect(result.current.data).toEqual(
      muscleState(rows, NOW, TRAINING_PARAMS_V1, targetedMuscles({ routine })),
    );
  });

  it("should count every muscle as targeted when the user has no active routine", async () => {
    installTrainingFake(server, { sets: [benchSet()], routine: null });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMuscleState(NOW), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.lats.volumeStatus).toBe("under");
  });

  it("should store the rows under the key of the start day and no derived number", async () => {
    installTrainingFake(server, { sets: [benchSet()], routine: routineRow() });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useMuscleState(NOW), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(queryClient.getQueryData(keys.training.sets(START_DAY))).toEqual([
      expect.objectContaining({ performed_at: SET_PERFORMED_AT, snapshot: snapshotOf() }),
    ]);
    const stored = JSON.stringify(queryClient.getQueryData(keys.training.activeRoutine));
    expect(stored).toContain(RECOGNISABLE_EXERCISE_NAME);
  });

  it("should read the start day in the user's zone, 15 days back, and the sets through today", async () => {
    // 23:30 UTC on the 17th is already the 18th in Auckland (UTC+13 in October).
    const fake = installTrainingFake(server, {
      sets: [benchSet()],
      routine: routineRow(),
      timeZone: "Pacific/Auckland",
    });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useMuscleState("2026-10-17T23:30:00Z"), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const url = fake.requestsTo("workout_sets")[0]?.url ?? new URL("http://none");
    expect(url.searchParams.getAll("workout_sessions.local_date")).toEqual([
      "gte.2026-10-03",
      "lte.2026-10-18",
    ]);
    expect(queryClient.getQueryData(keys.training.sets("2026-10-03"))).toHaveLength(1);
  });

  it("should not read the sets again when only the time moves within the day, and decay the heat", async () => {
    const fake = installTrainingFake(server, { sets: [benchSet()], routine: routineRow() });
    const { wrapper } = createWrapper();

    const { result, rerender } = renderHook(({ now }) => useMuscleState(now), {
      wrapper,
      initialProps: { now: "2026-10-17T07:00:00Z" },
    });
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const earlier = result.current.data?.chest_lower.heat ?? 0;

    rerender({ now: "2026-10-17T20:00:00Z" });

    await waitFor(() => {
      expect(result.current.data?.chest_lower.heat).toBeLessThan(earlier);
    });
    expect(fake.requestsTo("workout_sets")).toHaveLength(1);
  });

  it("should read the routine once for two hooks", async () => {
    const fake = installTrainingFake(server, { sets: [benchSet()], routine: routineRow() });
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => [useMuscleState(NOW), useMuscleState("2026-10-17T13:00:00Z")] as const,
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current[0].data).toBeDefined();
      expect(result.current[1].data).toBeDefined();
    });
    expect(fake.requestsTo("routines")).toHaveLength(1);
  });

  it("should be pending until the routine is known, so a muscle is never briefly under that is not targeted", async () => {
    installTrainingFake(server, { sets: [benchSet()], routine: routineRow() });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMuscleState(NOW), { wrapper });

    expect(result.current).toMatchObject({ data: undefined, isPending: true, isError: false });
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.data?.lats.volumeStatus).toBe("not_targeted");
  });

  it("should make no request at all while enabled is false", async () => {
    const fake = installTrainingFake(server, { sets: [benchSet()], routine: routineRow() });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMuscleState(NOW, { enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.requests).toEqual([]);
    expect(result.current).toMatchObject({ data: undefined, isPending: true, isError: false });
  });

  it("should stand in the rows read last when none are cached for today, not those of the highest start day", async () => {
    installTrainingFake(server, { routine: routineRow() });
    onlineManager.setOnline(false);
    try {
      const { queryClient, wrapper } = createWrapper();
      queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
      queryClient.setQueryData(keys.training.activeRoutine, null);
      // The higher start day was read first. The lower one, read later, holds no set at all.
      queryClient.setQueryData(keys.training.sets("2026-10-04"), [cachedSet], { updatedAt: 1_000 });
      queryClient.setQueryData(keys.training.sets("2026-10-01"), [], { updatedAt: 2_000 });

      const { result } = renderHook(() => useMuscleState(NOW), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      expect(result.current.data?.chest_lower.heat).toBe(0);
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it("should load once enabled turns true", async () => {
    installTrainingFake(server, { sets: [benchSet()], routine: routineRow() });
    const { wrapper } = createWrapper();

    const { result, rerender } = renderHook(({ enabled }) => useMuscleState(NOW, { enabled }), {
      wrapper,
      initialProps: { enabled: false },
    });
    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
  });

  it("should report the failure of the routine read, naming the action and the code only", async () => {
    const fake = installTrainingFake(server, { sets: [benchSet()], routine: routineRow() });
    fake.failWith("42501", "routines");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMuscleState(NOW), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not load your routine (42501)");
    expect(result.current.data).toBeUndefined();
    expect(fake.requestsTo("workout_sets")).toEqual([]);
  });

  it("should report the failure of the sets read, naming the action and the code only", async () => {
    const fake = installTrainingFake(server, { sets: [benchSet()], routine: routineRow() });
    fake.failWith("42501", "workout_sets");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMuscleState(NOW), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not load your sets (42501)");
  });

  it("should report the failure of the time zone read", async () => {
    const fake = installTrainingFake(server, { sets: [benchSet()], routine: routineRow() });
    fake.failWith("42501", "profiles");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMuscleState(NOW), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not load your time zone (42501)");
  });

  it("should read again only the sets read that failed", async () => {
    const fake = installTrainingFake(server, { sets: [benchSet()], routine: routineRow() });
    fake.failWith("42501", "workout_sets");
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMuscleState(NOW), { wrapper });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    const zoneReads = fake.requestsTo("profiles").length;
    const routineReads = fake.requestsTo("routines").length;
    const setReads = fake.requestsTo("workout_sets").length;
    fake.failWith(null);

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(fake.requestsTo("workout_sets").length).toBeGreaterThan(setReads);
    expect(fake.requestsTo("profiles")).toHaveLength(zoneReads);
    expect(fake.requestsTo("routines")).toHaveLength(routineReads);
  });
});
