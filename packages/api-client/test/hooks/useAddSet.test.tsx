import { act, renderHook } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useAddSet } from "../../src/hooks/useAddSet";
import { keys } from "../../src/queryKeys";
import {
  SET_SESSION_ID,
  cachedSession,
  installSetWritesFake,
  seedSetQueries,
  sessionSetOf,
} from "../support/setWrites";
import { EXERCISE_ID } from "../support/training";
import { createWrapper } from "../support/wrapper";

import type { SetAdd } from "../../src/repos/setWrites";

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

const logInput = (overrides: Partial<SetAdd> = {}): SetAdd => ({
  sessionId: SET_SESSION_ID,
  exerciseId: EXERCISE_ID,
  draft: { setType: "working", load: "60", reps: "8", rir: "2", rpe: "" },
  unit: "kg",
  effortMode: "rir",
  now: new Date("2026-10-18T09:30:00Z"),
  ...overrides,
});

describe("useAddSet", () => {
  it("should log the set and resolve to it as stored", async () => {
    const fake = installSetWritesFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddSet(), { wrapper });

    const stored = await act(() => result.current.mutateAsync(logInput()));

    expect(stored).toMatchObject({ session_id: SET_SESSION_ID, reps: 8 });
    expect(fake.inserts).toHaveLength(1);
  });

  it("should write once for a double press of Log set, the second joining the first", async () => {
    const fake = installSetWritesFake(server);
    const release = fake.holdWrites();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddSet(), { wrapper });

    const [first, second] = await act(async () => {
      const firstPress = result.current.mutateAsync(logInput());
      // A press a moment later carries a later time, and still joins the first.
      const secondPress = result.current.mutateAsync(
        logInput({ now: new Date("2026-10-18T09:30:00.400Z") }),
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      release();
      return Promise.all([firstPress, secondPress]);
    });

    expect(fake.inserts).toHaveLength(1);
    expect(second.id).toBe(first.id);
  });

  it("should log a second set with another draft after the first settles, one place further on", async () => {
    const fake = installSetWritesFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddSet(), { wrapper });

    await act(async () => {
      await Promise.all([
        result.current.mutateAsync(logInput()),
        result.current.mutateAsync(
          logInput({ draft: { setType: "working", load: "62.5", reps: "8", rir: "2", rpe: "" } }),
        ),
      ]);
    });

    expect(fake.inserts).toMatchObject([{ position: 0 }, { position: 1 }]);
  });

  it("should put the set in the cached session and the session in progress, in order", async () => {
    installSetWritesFake(server);
    const { queryClient, wrapper } = createWrapper();
    const earlier = sessionSetOf({ position: 0 });
    queryClient.setQueryData(keys.training.session(SET_SESSION_ID), cachedSession([earlier]));
    queryClient.setQueryData(keys.training.activeSession, cachedSession([earlier]));
    const { result } = renderHook(() => useAddSet(), { wrapper });

    const stored = await act(() => result.current.mutateAsync(logInput()));

    const idsOf = (key: readonly string[]) =>
      queryClient.getQueryData<{ sets: { id: string }[] }>(key)?.sets.map(({ id }) => id);
    expect(idsOf(keys.training.session(SET_SESSION_ID))).toEqual([earlier.id, stored.id]);
    expect(idsOf(keys.training.activeSession)).toEqual([earlier.id, stored.id]);
  });

  it("should leave a session that is not cached uncached", async () => {
    installSetWritesFake(server);
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useAddSet(), { wrapper });

    await act(() => result.current.mutateAsync(logInput()));

    expect(queryClient.getQueryData(keys.training.session(SET_SESSION_ID))).toBeUndefined();
    expect(queryClient.getQueryData(keys.training.activeSession)).toBeUndefined();
  });

  it("should mark the session, the heat, the week and the last performance stale, and leave the plan and routines alone", async () => {
    installSetWritesFake(server);
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedSetQueries(queryClient);
    const { result } = renderHook(() => useAddSet(), { wrapper });

    await act(() => result.current.mutateAsync(logInput()));

    for (const name of [
      "session",
      "activeSession",
      "sets",
      "weekSessions",
      "lastPerformance",
      "otherExerciseLastPerformance",
    ] as const) {
      expect(seeded.isStale(seeded.queryKeys[name])).toBe(true);
    }
    expect(seeded.isStale(seeded.queryKeys.activeRoutine)).toBe(false);
    expect(seeded.isStale(seeded.queryKeys.routines)).toBe(false);
    expect(seeded.isStale(seeded.queryKeys.routine)).toBe(false);
  });

  it("should throw, mark the families stale and keep the cached session as it was after a failure", async () => {
    const fake = installSetWritesFake(server);
    fake.failWith("23514");
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedSetQueries(queryClient);
    const cached = cachedSession([sessionSetOf()]);
    queryClient.setQueryData(keys.training.session(SET_SESSION_ID), cached);
    const { result } = renderHook(() => useAddSet(), { wrapper });

    const failure = await act(() =>
      result.current.mutateAsync(logInput()).catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(Error);
    expect(queryClient.getQueryData(keys.training.session(SET_SESSION_ID))).toEqual(cached);
    expect(seeded.isStale(seeded.queryKeys.sets)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.weekSessions)).toBe(true);
  });
});
