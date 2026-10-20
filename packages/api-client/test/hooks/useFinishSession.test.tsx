import { act, renderHook } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useFinishSession } from "../../src/hooks/useFinishSession";
import { keys } from "../../src/queryKeys";
import {
  OPEN_SESSION_ID,
  RECOGNISABLE_NOTE,
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

const input = {
  id: OPEN_SESSION_ID,
  endedAt: new Date("2026-10-18T10:00:00Z"),
  note: RECOGNISABLE_NOTE,
};

describe("useFinishSession", () => {
  it("should finish the session and resolve to it as stored", async () => {
    const fake = installSessionWritesFake(server, { sessions: [openSession()] });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useFinishSession(), { wrapper });

    const session = await act(() => result.current.mutateAsync(input));

    expect(session).toMatchObject({ id: OPEN_SESSION_ID, note: RECOGNISABLE_NOTE });
    expect(session.ended_at).not.toBeNull();
    expect(fake.updates).toHaveLength(1);
  });

  it("should put the finished session under its own key and clear it as the one in progress", async () => {
    installSessionWritesFake(server, { sessions: [openSession()] });
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.training.activeSession, openSession());
    const { result } = renderHook(() => useFinishSession(), { wrapper });

    const session = await act(() => result.current.mutateAsync(input));

    expect(queryClient.getQueryData(keys.training.session(OPEN_SESSION_ID))).toEqual(session);
    expect(queryClient.getQueryData(keys.training.activeSession)).toBeNull();
  });

  it("should leave a different session in progress as it was", async () => {
    installSessionWritesFake(server, { sessions: [openSession()] });
    const { queryClient, wrapper } = createWrapper();
    const other = openSession({ id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000555" });
    queryClient.setQueryData(keys.training.activeSession, other);
    const { result } = renderHook(() => useFinishSession(), { wrapper });

    await act(() => result.current.mutateAsync(input));

    expect(queryClient.getQueryData(keys.training.activeSession)).toEqual(other);
  });

  it("should write once for a double press of Finish, the second joining the first", async () => {
    const fake = installSessionWritesFake(server, { sessions: [openSession()] });
    const release = fake.holdWrites();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useFinishSession(), { wrapper });

    await act(async () => {
      const first = result.current.mutateAsync(input);
      const second = result.current.mutateAsync(input);
      await new Promise((resolve) => setTimeout(resolve, 50));
      release();
      await Promise.all([first, second]);
    });

    expect(fake.updates).toHaveLength(1);
  });

  it("should mark the session, the heat and the week stale, and leave the plan and the routines alone", async () => {
    installSessionWritesFake(server, { sessions: [openSession()] });
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedSessionQueries(queryClient);
    const { result } = renderHook(() => useFinishSession(), { wrapper });

    await act(() => result.current.mutateAsync(input));

    expect(seeded.isStale(seeded.queryKeys.session)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.activeSession)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.sets)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.weekSessions)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.history)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.historyList)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.exerciseTrend)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.routineTrend)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.activeRoutine)).toBe(false);
    expect(seeded.isStale(seeded.queryKeys.routines)).toBe(false);
  });

  it("should mark the families stale after a failure, with no note in the error", async () => {
    const fake = installSessionWritesFake(server, { sessions: [openSession()] });
    fake.failWith("23514", `the note ${RECOGNISABLE_NOTE} is too long`);
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedSessionQueries(queryClient);
    const { result } = renderHook(() => useFinishSession(), { wrapper });

    const failure = await act(() =>
      result.current.mutateAsync(input).catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(Error);
    expect(failure instanceof Error ? failure.message : "").toBe(
      "Could not finish the session (23514)",
    );
    expect(seeded.isStale(seeded.queryKeys.activeSession)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.sets)).toBe(true);
  });
});
