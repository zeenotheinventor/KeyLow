// @vitest-environment jsdom
// The hooks need a DOM to render in. The rest of the integration suite runs in node.
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { findGlobalExercise, logSets, startSession } from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { useDeleteSession } from "../../src/hooks/useDeleteSession";
import { useHistory } from "../../src/hooks/useHistory";
import { createWrapper } from "../support/wrapper";

import type { SavedExercise } from "./support/training";
import type { TestUser } from "./support/users";

// The history list over the real tables with real user JWTs. The profile's time zone is UTC (the column's default).

let exercise: SavedExercise;

beforeAll(async () => {
  exercise = await findGlobalExercise();
});

afterEach(() => {
  cleanup();
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

async function logSession(user: TestUser, localDate: string, workingSets: number) {
  const startedAt = `${localDate}T17:00:00Z`;
  const session = await startSession(user, localDate, { startedAt });
  await logSets(
    user,
    session,
    exercise,
    Array.from({ length: workingSets }, (_, index) => ({
      performedAt: new Date(Date.parse(startedAt) + (index + 1) * 60_000).toISOString(),
    })),
  );
  return session;
}

describe("useHistory over the real tables", () => {
  it("should list the golden week and the week before it as 3 and 4 sessions, newest first, with their totals", async () => {
    const owner = await createTestUser("key387");
    for (const [localDate, sets] of [
      ["2026-10-05", 4],
      ["2026-10-06", 3],
      ["2026-10-08", 4],
      ["2026-10-10", 4],
      ["2026-10-12", 5],
      ["2026-10-13", 6],
      ["2026-10-15", 3],
    ] as const) {
      await logSession(owner, localDate, sets);
    }
    const { wrapper } = createWrapper(owner.client);

    const { result } = renderHook(() => useHistory({ weeks: 2 }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });
    expect(
      result.current.data?.map((week) => [week.weekStart, week.sessionCount, week.workingSetTotal]),
    ).toEqual([
      ["2026-10-12", 3, 14],
      ["2026-10-05", 4, 15],
    ]);
    expect(result.current.hasEarlierWeeks).toBe(false);
  });

  it("should list no weeks for a user with no session", async () => {
    const newcomer = await createTestUser("key387");
    const { wrapper } = createWrapper(newcomer.client);

    const { result } = renderHook(() => useHistory({ weeks: 4 }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });
    expect(result.current.hasEarlierWeeks).toBe(false);
  });

  it("should drop a deleted session, and the week it leaves empty, after the delete refreshes the list", async () => {
    const owner = await createTestUser("key387");
    const lone = await logSession(owner, "2026-10-05", 2);
    await logSession(owner, "2026-10-12", 2);
    const { wrapper } = createWrapper(owner.client);
    const { result } = renderHook(
      () => ({ list: useHistory({ weeks: 2 }), remove: useDeleteSession() }),
      {
        wrapper,
      },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
    });

    await act(() => result.current.remove.mutateAsync(lone));

    await waitFor(() => {
      expect(result.current.list.data?.map(({ weekStart }) => weekStart)).toEqual(["2026-10-12"]);
    });
  });

  it("should never list another user's sessions", async () => {
    const owner = await createTestUser("key387");
    const stranger = await createTestUser("key387");
    await logSession(owner, "2026-10-12", 2);
    await logSession(stranger, "2026-10-19", 3);
    await logSession(stranger, "2026-09-28", 3);
    const { wrapper } = createWrapper(owner.client);

    const { result } = renderHook(() => useHistory({ weeks: 4 }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(result.current.data?.map(({ weekStart }) => weekStart)).toEqual(["2026-10-12"]);
    expect(result.current.data?.[0]?.workingSetTotal).toBe(2);
    expect(result.current.hasEarlierWeeks).toBe(false);
  });
});
