// @vitest-environment jsdom
// The hooks need a DOM to render in. The rest of the integration suite runs in node.
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { findGlobalExercise, logSets, present } from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { useAddSet } from "../../src/hooks/useAddSet";
import { useMuscleState } from "../../src/hooks/useMuscleState";
import { useRemoveSet } from "../../src/hooks/useRemoveSet";
import { useRestoreSet } from "../../src/hooks/useRestoreSet";
import { useUpdateSet } from "../../src/hooks/useUpdateSet";
import { startSession } from "../../src/repos/sessionWrites";
import { getSession } from "../../src/repos/trainingSessions";
import { createWrapper } from "../support/wrapper";

import type { SavedExercise } from "./support/training";

// The set hooks over the real tables with real user JWTs. The profile's time zone is UTC (the column's
// default). Every user is named key388 through the address.

const NOW = "2026-10-17T12:00:00Z";

let globalExercise: SavedExercise;

beforeAll(async () => {
  globalExercise = await findGlobalExercise();
});

afterEach(() => {
  cleanup();
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

async function sessionWithTwoSets() {
  const owner = await createTestUser("key388");
  const session = await startSession(owner.client, {
    now: new Date("2026-10-16T09:00:00Z"),
    tz: "UTC",
  });
  const ids = await logSets(owner, session.id, globalExercise, [
    { performedAt: "2026-10-16T09:10:00Z" },
    { performedAt: "2026-10-16T09:20:00Z" },
  ]);
  return { owner, sessionId: session.id, ids };
}

describe("the set hooks over the real tables", () => {
  it("should stop the heat read counting a removed set once the families refresh, and count it again after Undo", async () => {
    const { owner, ids } = await sessionWithTwoSets();
    const { wrapper } = createWrapper(owner.client);
    const { result } = renderHook(
      () => ({ heat: useMuscleState(NOW), remove: useRemoveSet(), restore: useRestoreSet() }),
      { wrapper },
    );
    const setsCounted = () => result.current.heat.data?.chest_lower.weeklySets;
    await waitFor(() => {
      expect(setsCounted()).toBe(2);
    });

    await act(() => result.current.remove.mutateAsync(present(ids[0], "the first set")));
    await waitFor(() => {
      expect(setsCounted()).toBe(1);
    });

    await act(() => result.current.restore.mutateAsync(present(ids[0], "the first set")));
    await waitFor(() => {
      expect(setsCounted()).toBe(2);
    });
  });

  it("should update the heat of the day when a past set is changed to a warm-up", async () => {
    const { owner, ids } = await sessionWithTwoSets();
    const { wrapper } = createWrapper(owner.client);
    const { result } = renderHook(() => ({ heat: useMuscleState(NOW), update: useUpdateSet() }), {
      wrapper,
    });
    const setsCounted = () => result.current.heat.data?.chest_lower.weeklySets;
    await waitFor(() => {
      expect(setsCounted()).toBe(2);
    });

    await act(() =>
      result.current.update.mutateAsync({
        id: present(ids[0], "the first set"),
        patch: { set_type: "warmup" },
      }),
    );

    await waitFor(() => {
      expect(setsCounted()).toBe(1);
    });
  });

  it("should store one set after two presses of Log set", async () => {
    const owner = await createTestUser("key388");
    const session = await startSession(owner.client, {
      now: new Date("2026-10-18T09:00:00Z"),
      tz: "UTC",
    });
    const { wrapper } = createWrapper(owner.client);
    const { result } = renderHook(() => useAddSet(), { wrapper });
    const draft = { setType: "working", load: "60", reps: "8", rir: "2", rpe: "" } as const;
    const press = (now: string) =>
      result.current.mutateAsync({
        sessionId: session.id,
        exerciseId: globalExercise.id,
        draft,
        unit: "kg",
        effortMode: "rir",
        now: new Date(now),
      });

    const [first, second] = await act(() =>
      Promise.all([press("2026-10-18T09:30:00Z"), press("2026-10-18T09:30:00.300Z")]),
    );

    expect(second.id).toBe(first.id);
    expect((await getSession(owner.client, session.id))?.sets).toHaveLength(1);
  });
});
