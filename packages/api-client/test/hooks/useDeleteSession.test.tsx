import { act, renderHook } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useDeleteSession } from "../../src/hooks/useDeleteSession";
import { keys } from "../../src/queryKeys";
import {
  OPEN_SESSION_ID,
  installSessionWritesFake,
  openSession,
  seedSessionQueries,
} from "../support/sessionWrites";
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

describe("useDeleteSession", () => {
  it("should delete the session with one call", async () => {
    const fake = installSessionWritesFake(server, { sessions: [openSession()] });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteSession(), { wrapper });

    await act(() => result.current.mutateAsync(OPEN_SESSION_ID));

    expect(fake.deletes).toEqual([{ p_session_id: OPEN_SESSION_ID }]);
  });

  it("should read the deleted session as missing and clear it as the one in progress", async () => {
    installSessionWritesFake(server, { sessions: [openSession()] });
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.training.session(OPEN_SESSION_ID), openSession());
    queryClient.setQueryData(keys.training.activeSession, openSession());
    const { result } = renderHook(() => useDeleteSession(), { wrapper });

    await act(() => result.current.mutateAsync(OPEN_SESSION_ID));

    expect(queryClient.getQueryData(keys.training.session(OPEN_SESSION_ID))).toBeNull();
    expect(queryClient.getQueryData(keys.training.activeSession)).toBeNull();
  });

  it("should write once for a double press of Delete, the second joining the first", async () => {
    const fake = installSessionWritesFake(server, { sessions: [openSession()] });
    const release = fake.holdWrites();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteSession(), { wrapper });

    await act(async () => {
      const first = result.current.mutateAsync(OPEN_SESSION_ID);
      const second = result.current.mutateAsync(OPEN_SESSION_ID);
      await new Promise((resolve) => setTimeout(resolve, 50));
      release();
      await Promise.all([first, second]);
    });

    expect(fake.deletes).toHaveLength(1);
  });

  it("should mark the sessions, the heat and the week stale, and leave the plan and the routines alone", async () => {
    installSessionWritesFake(server, { sessions: [openSession()] });
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedSessionQueries(queryClient);
    const { result } = renderHook(() => useDeleteSession(), { wrapper });

    await act(() => result.current.mutateAsync(OPEN_SESSION_ID));

    expect(seeded.isStale(seeded.queryKeys.session)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.activeSession)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.sets)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.weekSessions)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.lastPerformance)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.activeRoutine)).toBe(false);
    expect(seeded.isStale(seeded.queryKeys.routines)).toBe(false);
    expect(seeded.isStale(seeded.queryKeys.routine)).toBe(false);
  });

  it("should mark the families stale after a failure and leave the cached session as it was", async () => {
    const fake = installSessionWritesFake(server, { sessions: [openSession()] });
    fake.failWith("P0002");
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedSessionQueries(queryClient);
    const cached = openSession();
    queryClient.setQueryData(keys.training.session(OPEN_SESSION_ID), cached);
    const { result } = renderHook(() => useDeleteSession(), { wrapper });

    const failure = await act(() =>
      result.current.mutateAsync(OPEN_SESSION_ID).catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(Error);
    expect(queryClient.getQueryData(keys.training.session(OPEN_SESSION_ID))).toEqual(cached);
    expect(seeded.isStale(seeded.queryKeys.sets)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.weekSessions)).toBe(true);
  });
});
