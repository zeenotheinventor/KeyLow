import { act, renderHook } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useUpdateSet } from "../../src/hooks/useUpdateSet";
import { keys } from "../../src/queryKeys";
import {
  OTHER_SESSION_ID,
  SET_SESSION_ID,
  cachedSession,
  installSetWritesFake,
  seedSetQueries,
  sessionSetOf,
  storedSet,
} from "../support/setWrites";
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

describe("useUpdateSet", () => {
  it("should update the set with the patch", async () => {
    const set = storedSet();
    const fake = installSetWritesFake(server, { sets: [set] });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateSet(), { wrapper });

    await act(() => result.current.mutateAsync({ id: set.id, patch: { reps: 10 } }));

    expect(fake.updates.map(({ body }) => body)).toEqual([{ reps: 10 }]);
  });

  it("should replace the set in the cached session", async () => {
    const set = storedSet({ reps: 8 });
    installSetWritesFake(server, { sets: [set] });
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(
      keys.training.session(SET_SESSION_ID),
      cachedSession([sessionSetOf({ ...set })]),
    );
    const { result } = renderHook(() => useUpdateSet(), { wrapper });

    await act(() => result.current.mutateAsync({ id: set.id, patch: { reps: 10 } }));

    const cached = queryClient.getQueryData<{ sets: { reps: number }[] }>(
      keys.training.session(SET_SESSION_ID),
    );
    expect(cached?.sets.map(({ reps }) => reps)).toEqual([10]);
  });

  it("should leave a session in progress that is another session as it is, so a past set can be edited from history", async () => {
    const set = storedSet({ reps: 8 });
    installSetWritesFake(server, { sets: [set] });
    const { queryClient, wrapper } = createWrapper();
    const openElsewhere = cachedSession(
      [sessionSetOf({ session_id: OTHER_SESSION_ID })],
      OTHER_SESSION_ID,
    );
    queryClient.setQueryData(
      keys.training.session(SET_SESSION_ID),
      cachedSession([sessionSetOf({ ...set })]),
    );
    queryClient.setQueryData(keys.training.activeSession, openElsewhere);
    const { result } = renderHook(() => useUpdateSet(), { wrapper });

    await act(() => result.current.mutateAsync({ id: set.id, patch: { reps: 10 } }));

    expect(queryClient.getQueryData(keys.training.activeSession)).toEqual(openElsewhere);
    const cached = queryClient.getQueryData<{ sets: { reps: number }[] }>(
      keys.training.session(SET_SESSION_ID),
    );
    expect(cached?.sets.map(({ reps }) => reps)).toEqual([10]);
  });

  it("should run an edit made while another is on its way after it, the last one winning", async () => {
    const set = storedSet({ reps: 8 });
    const fake = installSetWritesFake(server, { sets: [set] });
    const release = fake.holdWrites();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateSet(), { wrapper });

    const requestsBeforeRelease = await act(async () => {
      const first = result.current.mutateAsync({ id: set.id, patch: { reps: 9 } });
      await new Promise((resolve) => setTimeout(resolve, 30));
      const second = result.current.mutateAsync({ id: set.id, patch: { reps: 10 } });
      await new Promise((resolve) => setTimeout(resolve, 50));
      const seen = [...fake.requests];
      release();
      await Promise.all([first, second]);
      return seen;
    });

    // Until the first edit was released, the second had asked for nothing.
    expect(requestsBeforeRelease).toEqual(["update"]);
    expect(fake.updates.map(({ body }) => body)).toEqual([{ reps: 9 }, { reps: 10 }]);
  });

  it("should mark the session, the heat and the week stale, which is how editing a past set updates that day", async () => {
    const set = storedSet();
    installSetWritesFake(server, { sets: [set] });
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedSetQueries(queryClient);
    const { result } = renderHook(() => useUpdateSet(), { wrapper });

    await act(() => result.current.mutateAsync({ id: set.id, patch: { rir: 0 } }));

    for (const name of [
      "session",
      "sessionOther",
      "sets",
      "weekSessions",
      "history",
      "historyList",
      "lastPerformance",
    ] as const) {
      expect(seeded.isStale(seeded.queryKeys[name])).toBe(true);
    }
    expect(seeded.isStale(seeded.queryKeys.activeRoutine)).toBe(false);
  });

  it("should throw a RangeError and still mark the families stale when the patch breaks a rule", async () => {
    const set = storedSet();
    const fake = installSetWritesFake(server, { sets: [set] });
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedSetQueries(queryClient);
    const { result } = renderHook(() => useUpdateSet(), { wrapper });

    const failure = await act(() =>
      result.current
        .mutateAsync({ id: set.id, patch: { reps: 0 } })
        .catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(RangeError);
    expect(fake.requests).toEqual([]);
    expect(seeded.isStale(seeded.queryKeys.sets)).toBe(true);
  });
});
