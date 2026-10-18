import { act, renderHook } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useRemoveSet } from "../../src/hooks/useRemoveSet";
import { useRestoreSet } from "../../src/hooks/useRestoreSet";
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

const idsOf = (queryClient: QueryClient, key: readonly string[]) =>
  queryClient.getQueryData<{ sets: { id: string }[] }>(key)?.sets.map(({ id }) => id);

describe("useRemoveSet", () => {
  it("should remove the set and take it out of the cached session and the session in progress", async () => {
    const kept = storedSet({ position: 0 });
    const gone = storedSet({ position: 1 });
    installSetWritesFake(server, { sets: [kept, gone] });
    const { queryClient, wrapper } = createWrapper();
    const cached = cachedSession([sessionSetOf({ ...kept }), sessionSetOf({ ...gone })]);
    queryClient.setQueryData(keys.training.session(SET_SESSION_ID), cached);
    queryClient.setQueryData(keys.training.activeSession, cached);
    const { result } = renderHook(() => useRemoveSet(), { wrapper });

    await act(() => result.current.mutateAsync(gone.id));

    expect(idsOf(queryClient, keys.training.session(SET_SESSION_ID))).toEqual([kept.id]);
    expect(idsOf(queryClient, keys.training.activeSession)).toEqual([kept.id]);
  });

  it("should mark the session, the heat and the week stale, so a removed set stops counting", async () => {
    const set = storedSet();
    installSetWritesFake(server, { sets: [set] });
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedSetQueries(queryClient);
    const { result } = renderHook(() => useRemoveSet(), { wrapper });

    await act(() => result.current.mutateAsync(set.id));

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
    expect(seeded.isStale(seeded.queryKeys.routines)).toBe(false);
  });

  it("should mark the families stale after a failure and keep the set in the cache", async () => {
    const set = storedSet();
    const fake = installSetWritesFake(server, { sets: [set] });
    fake.failWith("42501");
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedSetQueries(queryClient);
    queryClient.setQueryData(
      keys.training.session(SET_SESSION_ID),
      cachedSession([sessionSetOf({ ...set })]),
    );
    const { result } = renderHook(() => useRemoveSet(), { wrapper });

    const failure = await act(() =>
      result.current.mutateAsync(set.id).catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(Error);
    expect(idsOf(queryClient, keys.training.session(SET_SESSION_ID))).toEqual([set.id]);
    expect(seeded.isStale(seeded.queryKeys.sets)).toBe(true);
  });

  it("should leave a session in progress that is another session as it is, and update the set's own session", async () => {
    const kept = storedSet({ position: 0 });
    const gone = storedSet({ position: 1 });
    installSetWritesFake(server, { sets: [kept, gone] });
    const { queryClient, wrapper } = createWrapper();
    // Out of list order on purpose: a remove adds no live set, so only a re-sort would change it.
    const openElsewhere = cachedSession(
      [
        sessionSetOf({ session_id: OTHER_SESSION_ID, position: 5 }),
        sessionSetOf({ session_id: OTHER_SESSION_ID, position: 1 }),
      ],
      OTHER_SESSION_ID,
    );
    queryClient.setQueryData(
      keys.training.session(SET_SESSION_ID),
      cachedSession([sessionSetOf({ ...kept }), sessionSetOf({ ...gone })]),
    );
    queryClient.setQueryData(keys.training.activeSession, openElsewhere);
    const { result } = renderHook(() => useRemoveSet(), { wrapper });

    await act(() => result.current.mutateAsync(gone.id));

    expect(queryClient.getQueryData(keys.training.activeSession)).toEqual(openElsewhere);
    expect(idsOf(queryClient, keys.training.session(SET_SESSION_ID))).toEqual([kept.id]);
  });

  it("should make an Undo tapped while the remove is on its way wait for it", async () => {
    const set = storedSet();
    const fake = installSetWritesFake(server, { sets: [set] });
    const release = fake.holdWrites();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => ({ remove: useRemoveSet(), restore: useRestoreSet() }), {
      wrapper,
    });
    const id = set.id;

    const requestsBeforeRelease = await act(async () => {
      const removal = result.current.remove.mutateAsync(id);
      await new Promise((resolve) => setTimeout(resolve, 30));
      const undo = result.current.restore.mutateAsync(id);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const seen = [...fake.requests];
      release();
      await Promise.all([removal, undo]);
      return seen;
    });

    // Until the remove was released, the Undo had asked for nothing.
    expect(requestsBeforeRelease).toEqual(["update"]);
    expect(fake.liveIdsOf(SET_SESSION_ID)).toEqual([id]);
  });
});
