// @vitest-environment jsdom
// The hooks need a DOM to render in. The rest of the integration suite runs in node.
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { findGlobalExercise, logSets } from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { useDeleteSession } from "../../src/hooks/useDeleteSession";
import { useMuscleState } from "../../src/hooks/useMuscleState";
import { useStartSession } from "../../src/hooks/useStartSession";
import { startSession } from "../../src/repos/sessionWrites";
import { createWrapper } from "../support/wrapper";

import type { SavedExercise } from "./support/training";

// The session hooks over the real tables with real user JWTs. The profile's time zone is UTC (the column's default).

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

describe("useDeleteSession over the real tables", () => {
  it("should stop the heat read counting the sets of a deleted session once the families refresh", async () => {
    const owner = await createTestUser("key386");
    const session = await startSession(owner.client, {
      now: new Date("2026-10-16T09:00:00Z"),
      tz: "UTC",
    });
    await logSets(owner, session.id, globalExercise, [
      { performedAt: "2026-10-16T09:10:00Z" },
      { performedAt: "2026-10-16T09:20:00Z" },
    ]);
    const { wrapper } = createWrapper(owner.client);
    const { result } = renderHook(
      () => ({ heat: useMuscleState(NOW), remove: useDeleteSession() }),
      {
        wrapper,
      },
    );
    const setsCounted = () => result.current.heat.data?.chest_lower.weeklySets;
    await waitFor(() => {
      expect(setsCounted()).toBe(2);
    });

    await act(() => result.current.remove.mutateAsync(session.id));

    await waitFor(() => {
      expect(setsCounted()).toBe(0);
    });
  });
});

describe("useStartSession over the real tables", () => {
  it("should leave one open session after two presses of Start", async () => {
    const owner = await createTestUser("key386");
    const { wrapper } = createWrapper(owner.client);
    const { result } = renderHook(() => useStartSession(), { wrapper });

    const [first, second] = await act(() =>
      Promise.all([
        result.current.mutateAsync({ now: new Date("2026-10-18T09:00:00Z"), tz: "UTC" }),
        result.current.mutateAsync({ now: new Date("2026-10-18T09:00:01Z"), tz: "UTC" }),
      ]),
    );

    expect(second.id).toBe(first.id);
  });
});
