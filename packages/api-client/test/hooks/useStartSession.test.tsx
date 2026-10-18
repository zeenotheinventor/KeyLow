import { act, renderHook } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useStartSession } from "../../src/hooks/useStartSession";
import { keys } from "../../src/queryKeys";
import {
  NEW_SESSION_ID,
  OPEN_SESSION_ID,
  installSessionWritesFake,
  openSession,
  seedSessionQueries,
} from "../support/sessionWrites";
import { ROUTINE_DAY_ID } from "../support/training";
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

const input = { routineDayId: ROUTINE_DAY_ID, now: new Date("2026-10-18T09:00:00Z"), tz: "UTC" };

describe("useStartSession", () => {
  it("should start the session and resolve to it as stored", async () => {
    const fake = installSessionWritesFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStartSession(), { wrapper });

    const session = await act(() => result.current.mutateAsync(input));

    expect(session).toMatchObject({ id: NEW_SESSION_ID, ended_at: null });
    expect(fake.inserts).toHaveLength(1);
  });

  it("should put the session in the cache as the one in progress and under its own key", async () => {
    installSessionWritesFake(server);
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useStartSession(), { wrapper });

    const session = await act(() => result.current.mutateAsync(input));

    expect(queryClient.getQueryData(keys.training.activeSession)).toEqual(session);
    expect(queryClient.getQueryData(keys.training.session(session.id))).toEqual(session);
  });

  it("should make one session of a double press, the second joining the first", async () => {
    const fake = installSessionWritesFake(server);
    const release = fake.holdWrites();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStartSession(), { wrapper });

    const sessions = await act(async () => {
      const first = result.current.mutateAsync(input);
      const second = result.current.mutateAsync(input);
      await new Promise((resolve) => setTimeout(resolve, 50));
      release();
      return Promise.all([first, second]);
    });

    expect(sessions.map(({ id }) => id)).toEqual([NEW_SESSION_ID, NEW_SESSION_ID]);
    expect(fake.inserts).toHaveLength(1);
  });

  it("should make one session of a second press a moment later, which is a different input", async () => {
    const fake = installSessionWritesFake(server);
    const release = fake.holdWrites();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStartSession(), { wrapper });

    const sessions = await act(async () => {
      const first = result.current.mutateAsync(input);
      const second = result.current.mutateAsync({
        ...input,
        now: new Date("2026-10-18T09:00:01Z"),
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      release();
      return Promise.all([first, second]);
    });

    expect(sessions.map(({ id }) => id)).toEqual([NEW_SESSION_ID, NEW_SESSION_ID]);
    expect(fake.inserts).toHaveLength(1);
  });

  it("should resolve to the session already in progress and insert nothing", async () => {
    const fake = installSessionWritesFake(server, { sessions: [openSession()] });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStartSession(), { wrapper });

    const session = await act(() => result.current.mutateAsync(input));

    expect(session.id).toBe(OPEN_SESSION_ID);
    expect(fake.inserts).toEqual([]);
  });

  it("should mark the session, the heat and the week stale, and leave the plan and the routines alone", async () => {
    installSessionWritesFake(server);
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedSessionQueries(queryClient);
    const { result } = renderHook(() => useStartSession(), { wrapper });

    await act(() => result.current.mutateAsync(input));

    expect(seeded.isStale(seeded.queryKeys.session)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.sets)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.weekSessions)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.activeRoutine)).toBe(false);
    expect(seeded.isStale(seeded.queryKeys.routines)).toBe(false);
    expect(seeded.isStale(seeded.queryKeys.routine)).toBe(false);
  });

  it("should mark the families stale after a failure too, and leave the cached session in progress as it was", async () => {
    const fake = installSessionWritesFake(server);
    fake.failWith("42501");
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedSessionQueries(queryClient);
    const { result } = renderHook(() => useStartSession(), { wrapper });

    const failure = await act(() =>
      result.current.mutateAsync(input).catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(Error);
    expect(queryClient.getQueryData(keys.training.activeSession)).toBeNull();
    expect(seeded.isStale(seeded.queryKeys.activeSession)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.sets)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.weekSessions)).toBe(true);
  });
});
