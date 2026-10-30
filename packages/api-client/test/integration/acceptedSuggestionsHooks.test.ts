// @vitest-environment jsdom
// The hooks need a DOM to render in. The rest of the integration suite runs in node.
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { saveExercise } from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { useAcceptSuggestion } from "../../src/hooks/useAcceptSuggestion";
import { useSuggestion } from "../../src/hooks/useSuggestion";
import { useUndoAcceptedSuggestion } from "../../src/hooks/useUndoAcceptedSuggestion";
import { useWeekComparison } from "../../src/hooks/useWeekComparison";
import { saveTrainingGoals } from "../../src/repos/trainingGoals";
import { vTaperAnswers } from "../support/trainingGoals";
import { createWrapper } from "../support/wrapper";

import type { TestUser } from "./support/users";
import type { ExerciseMuscleEntry } from "@keylow/core/schemas";

// Accepting a suggestion into a day, and its Undo, over the real tables. The profile's time zone is UTC
// (the column's default) and the user has no routine, so the plan is empty and what the week projects is
// the accepted suggestion alone. The exercise is the user's own, named key406-, with upper chest as its
// one primary muscle, so the sets the suggestion adds are the week's projected upper chest sets.

const WEEK_START = "2026-10-12";
const FRIDAY = "2026-10-16";
const FRIDAY_NOON = "2026-10-16T12:00:00Z";
const SATURDAY = "2026-10-17";

const PRESS_MUSCLES: ExerciseMuscleEntry[] = [
  { muscle_id: "chest_upper", role: "primary", weight: 1 },
];

let owner: TestUser;
let stranger: TestUser;

beforeAll(async () => {
  [owner, stranger] = await Promise.all([createTestUser("key406"), createTestUser("key406")]);
  await saveExercise(owner, "press", PRESS_MUSCLES);
  await saveTrainingGoals(owner.client, { ...vTaperAnswers, equipment: ["barbell"] });
});

afterEach(() => {
  cleanup();
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

const render = (user: TestUser) => {
  const { wrapper } = createWrapper(user.client);
  return renderHook(
    () => ({
      suggestion: useSuggestion({ day: SATURDAY, now: FRIDAY_NOON }),
      week: useWeekComparison(WEEK_START),
      accept: useAcceptSuggestion(),
      undo: useUndoAcceptedSuggestion(),
    }),
    { wrapper },
  );
};

const projectedUpperChest = (current: ReturnType<typeof render>["result"]["current"]) =>
  current.week.data?.chest_upper.projectedWeeklySets;

describe("accepting a suggestion over the real tables", () => {
  it("should add the suggestion to the week's projected sets, replace it when accepted again, and take it out on Undo", async () => {
    const { result } = render(owner);
    await waitFor(() => {
      expect(result.current.suggestion.data?.suggestion).toBeTruthy();
      expect(projectedUpperChest(result.current)).toBe(0);
    });
    const suggestion = result.current.suggestion.data?.suggestion;
    if (suggestion === null || suggestion === undefined || suggestion.kind === "nothing") {
      throw new Error("Expected a suggestion for a user with a goal and an exercise");
    }
    const input = { suggestion, localDate: SATURDAY, routineDayId: null };

    const first = await act(() => result.current.accept.mutateAsync(input));
    await waitFor(() => {
      expect(projectedUpperChest(result.current)).toBeGreaterThan(0);
    });
    const afterFirst = projectedUpperChest(result.current);
    const second = await act(() => result.current.accept.mutateAsync(input));
    await waitFor(() => {
      expect(projectedUpperChest(result.current)).toBe(afterFirst);
    });
    expect(second.id).not.toBe(first.id);
    await act(() => result.current.undo.mutateAsync(second.id));

    await waitFor(() => {
      expect(projectedUpperChest(result.current)).toBe(0);
    });
  });

  it("should not count another user's accepted suggestion in the week", async () => {
    const { result } = render(stranger);

    await waitFor(() => {
      expect(result.current.week.data).toBeDefined();
    });
    expect(projectedUpperChest(result.current)).toBe(0);
  });

  it("should refuse an Undo of a row that is not the caller's", async () => {
    const { result: ownersResult } = render(owner);
    await waitFor(() => {
      expect(ownersResult.current.suggestion.data?.suggestion).toBeTruthy();
    });
    const suggestion = ownersResult.current.suggestion.data?.suggestion;
    if (suggestion === null || suggestion === undefined || suggestion.kind === "nothing") {
      throw new Error("Expected a suggestion for a user with a goal and an exercise");
    }
    const stored = await act(() =>
      ownersResult.current.accept.mutateAsync({
        suggestion,
        localDate: FRIDAY,
        routineDayId: null,
      }),
    );
    const { result: strangersResult } = render(stranger);

    await act(async () => {
      await expect(strangersResult.current.undo.mutateAsync(stored.id)).rejects.toThrow(
        "Could not undo adding the suggestion (PGRST116)",
      );
    });
  });
});
