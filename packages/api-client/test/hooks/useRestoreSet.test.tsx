import { act, renderHook } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useRestoreSet } from "../../src/hooks/useRestoreSet";
import { keys } from "../../src/queryKeys";
import {
  OTHER_SESSION_ID,
  SET_SESSION_ID,
  cachedSession,
  installSetWritesFake,
  liveSetsOf,
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

const REMOVED_AT = "2026-10-18T09:00:00+00:00";

describe("useRestoreSet", () => {
  it("should restore the set and put it back in the cached session in its place", async () => {
    const first = storedSet({ position: 0 });
    const removed = storedSet({ position: 1, deleted_at: REMOVED_AT });
    const last = storedSet({ position: 2 });
    installSetWritesFake(server, { sets: [first, removed, last] });
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(
      keys.training.session(SET_SESSION_ID),
      cachedSession([sessionSetOf({ ...first }), sessionSetOf({ ...last })]),
    );
    const { result } = renderHook(() => useRestoreSet(), { wrapper });

    await act(() => result.current.mutateAsync(removed.id));

    const cached = queryClient.getQueryData<{ sets: { id: string }[] }>(
      keys.training.session(SET_SESSION_ID),
    );
    expect(cached?.sets.map(({ id }) => id)).toEqual([first.id, removed.id, last.id]);
  });

  it("should leave a session in progress that is another session as it is, and update the set's own session", async () => {
    const first = storedSet({ position: 0 });
    const removed = storedSet({ position: 1, deleted_at: REMOVED_AT });
    installSetWritesFake(server, { sets: [first, removed] });
    const { queryClient, wrapper } = createWrapper();
    const openElsewhere = cachedSession(
      [sessionSetOf({ session_id: OTHER_SESSION_ID })],
      OTHER_SESSION_ID,
    );
    queryClient.setQueryData(
      keys.training.session(SET_SESSION_ID),
      cachedSession([sessionSetOf({ ...first })]),
    );
    queryClient.setQueryData(keys.training.activeSession, openElsewhere);
    const { result } = renderHook(() => useRestoreSet(), { wrapper });

    await act(() => result.current.mutateAsync(removed.id));

    expect(queryClient.getQueryData(keys.training.activeSession)).toEqual(openElsewhere);
    const cached = queryClient.getQueryData<{ sets: { id: string }[] }>(
      keys.training.session(SET_SESSION_ID),
    );
    expect(cached?.sets.map(({ id }) => id)).toEqual([first.id, removed.id]);
  });

  it("should mark the session, the heat and the week stale, so a restored set counts again", async () => {
    const removed = storedSet({ deleted_at: REMOVED_AT });
    installSetWritesFake(server, { sets: [removed] });
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedSetQueries(queryClient);
    const { result } = renderHook(() => useRestoreSet(), { wrapper });

    await act(() => result.current.mutateAsync(removed.id));

    for (const name of [
      "session",
      "activeSession",
      "sets",
      "weekSessions",
      "history",
      "historyList",
      "lastPerformance",
    ] as const) {
      expect(seeded.isStale(seeded.queryKeys[name])).toBe(true);
    }
  });

  it("should refuse a restore into a full session with a rule, and still mark the families stale", async () => {
    const removed = storedSet({ deleted_at: REMOVED_AT, position: 500 });
    const fake = installSetWritesFake(server, { sets: [...liveSetsOf(200), removed] });
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedSetQueries(queryClient);
    const { result } = renderHook(() => useRestoreSet(), { wrapper });

    const failure = await act(() =>
      result.current.mutateAsync(removed.id).catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(RangeError);
    expect(fake.updates).toEqual([]);
    expect(seeded.isStale(seeded.queryKeys.sets)).toBe(true);
  });
});
