import { act, renderHook } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useReorderSets } from "../../src/hooks/useReorderSets";
import {
  SET_IDS,
  SET_SESSION_ID,
  installSetWritesFake,
  seedSetQueries,
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

const [FIRST, SECOND, THIRD] = SET_IDS;

const threeSets = () => [
  storedSet({ id: FIRST, position: 0 }),
  storedSet({ id: SECOND, position: 1 }),
  storedSet({ id: THIRD, position: 2 }),
];

describe("useReorderSets", () => {
  it("should put the sets in the new order", async () => {
    const fake = installSetWritesFake(server, { sets: threeSets() });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useReorderSets(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ sessionId: SET_SESSION_ID, orderedIds: [THIRD, FIRST, SECOND] }),
    );

    expect(fake.liveIdsOf(SET_SESSION_ID)).toEqual([THIRD, FIRST, SECOND]);
  });

  it("should run a reorder made while another is on its way after it", async () => {
    const fake = installSetWritesFake(server, { sets: threeSets() });
    const release = fake.holdWrites();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useReorderSets(), { wrapper });

    const requestsBeforeRelease = await act(async () => {
      const first = result.current.mutateAsync({
        sessionId: SET_SESSION_ID,
        orderedIds: [SECOND, FIRST],
      });
      await new Promise((resolve) => setTimeout(resolve, 30));
      const second = result.current.mutateAsync({
        sessionId: SET_SESSION_ID,
        orderedIds: [THIRD, SECOND],
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      const seen = [...fake.requests];
      release();
      await Promise.all([first, second]);
      return seen;
    });

    // Until the first reorder was released, the second had read nothing.
    expect(requestsBeforeRelease).toEqual(["read", "update", "update"]);
    expect(fake.requests.filter((request) => request === "read")).toHaveLength(2);
  });

  it("should mark the session, the heat and the week stale", async () => {
    installSetWritesFake(server, { sets: threeSets() });
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedSetQueries(queryClient);
    const { result } = renderHook(() => useReorderSets(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ sessionId: SET_SESSION_ID, orderedIds: [SECOND, FIRST] }),
    );

    for (const name of [
      "session",
      "activeSession",
      "sets",
      "weekSessions",
      "history",
      "historyList",
    ] as const) {
      expect(seeded.isStale(seeded.queryKeys[name])).toBe(true);
    }
    expect(seeded.isStale(seeded.queryKeys.routines)).toBe(false);
  });

  it("should mark the families stale after a failure that left some sets moved", async () => {
    const fake = installSetWritesFake(server, { sets: threeSets() });
    fake.failWith("42501");
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedSetQueries(queryClient);
    const { result } = renderHook(() => useReorderSets(), { wrapper });

    const failure = await act(() =>
      result.current
        .mutateAsync({ sessionId: SET_SESSION_ID, orderedIds: [SECOND, FIRST] })
        .catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(Error);
    expect(seeded.isStale(seeded.queryKeys.session)).toBe(true);
  });
});
