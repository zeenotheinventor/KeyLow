// @vitest-environment jsdom
// The hooks need a DOM to render in. The rest of the integration suite runs in node.
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  logSets,
  saveExercise,
  saveRoutine,
  setActiveRoutine,
  startSession,
} from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { useMuscleState } from "../../src/hooks/useMuscleState";
import { useSaveTrainingGoals } from "../../src/hooks/useSaveTrainingGoals";
import { vTaperAnswers } from "../support/trainingGoals";
import { createWrapper } from "../support/wrapper";

import type { TestUser } from "./support/users";

// The goal's priorities in the muscle state over the real tables. The profile's time zone is UTC (the
// column's default).

const NOW = "2026-10-17T12:00:00Z";

let owner: TestUser;

beforeAll(async () => {
  owner = await createTestUser("key404");
  const bench = await saveExercise(owner, "key404-bench");
  const routineId = await saveRoutine(owner, null, [
    { weekday: 0, name: "push", exerciseIds: [bench.id], targetSets: 3 },
  ]);
  await setActiveRoutine(owner, routineId);
  const session = await startSession(owner, "2026-10-16");
  await logSets(owner, session, bench, [{ performedAt: "2026-10-16T09:30:00Z" }]);
});

afterEach(() => {
  cleanup();
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe("useMuscleState with a saved training goal, over the real tables", () => {
  it("should change no volume status when the V-taper goal is saved, since a status reads the sets alone", async () => {
    const { wrapper } = createWrapper(owner.client);
    const { result } = renderHook(
      () => ({ state: useMuscleState(NOW), save: useSaveTrainingGoals() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.state.data).toBeDefined();
    });
    const before = result.current.state.data;
    expect(before?.lats.volumeStatus).toBe("not_trained");

    await act(() => result.current.save.mutateAsync(vTaperAnswers));

    const state = result.current.state.data;
    expect(state?.lats.volumeStatus).toBe("not_trained");
    expect(state?.delt_side.volumeStatus).toBe("not_trained");
    expect(state?.abs.volumeStatus).toBe("not_trained");
    expect(state?.chest_lower.volumeStatus).toBe(before?.chest_lower.volumeStatus);
  });
});
