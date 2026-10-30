import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useAcceptSuggestion } from "../../src/hooks/useAcceptSuggestion";
import { useMuscleDetail } from "../../src/hooks/useMuscleDetail";
import { useUndoAcceptedSuggestion } from "../../src/hooks/useUndoAcceptedSuggestion";
import { useWeekComparison } from "../../src/hooks/useWeekComparison";
import {
  LEGS_DAY_ID,
  THURSDAY,
  goldenSuggestion,
  installAcceptedSuggestionsFake,
} from "../support/acceptedSuggestions";
import { goldenLibraryRows } from "../support/goldenLibraryRows";
import { GOLDEN_WEEK_START, goldenSessions, goldenWeekData } from "../support/goldenWeekRows";
import { installLibraryFake } from "../support/suggestionLibrary";
import { installTrainingFake } from "../support/training";
import { trainingGoalsRow, vTaperAnswers } from "../support/trainingGoals";
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

// Zee's agreement on KEY-396 as the screens will use it: on Wednesday 14 October at 12:00 the V-taper user
// accepts 3 sets of incline dumbbell press into Thursday's Legs, accepts again, and then taps Undo.
const WEDNESDAY_NOON = "2026-10-14T12:00:00+01:00";

const sessionsBeforeThursday = goldenSessions.filter((session) => session.local_date < THURSDAY);

const accept = { suggestion: goldenSuggestion, localDate: THURSDAY, routineDayId: LEGS_DAY_ID };

const open = () => {
  installTrainingFake(server, {
    ...goldenWeekData,
    sessions: sessionsBeforeThursday,
    sets: sessionsBeforeThursday.flatMap((session) => session.workout_sets),
    goal: trainingGoalsRow(vTaperAnswers),
  });
  installLibraryFake(server, goldenLibraryRows);
  const fake = installAcceptedSuggestionsFake(server);
  const { wrapper } = createWrapper();
  const rendered = renderHook(
    () => ({
      week: useWeekComparison(GOLDEN_WEEK_START),
      detail: useMuscleDetail("chest_upper", {
        view: "projected",
        weekStart: GOLDEN_WEEK_START,
        now: WEDNESDAY_NOON,
      }),
      accept: useAcceptSuggestion(),
      undo: useUndoAcceptedSuggestion(),
    }),
    { wrapper },
  );
  return { fake, ...rendered };
};

const upperChestSets = (current: ReturnType<typeof open>["result"]["current"]) =>
  current.week.data?.chest_upper.projectedWeeklySets;

describe("accepting the golden Thursday suggestion on Wednesday", () => {
  it("should store one row for Thursday and raise the week's projected upper chest sets from 9.6 to 12.6", async () => {
    const { fake, result } = open();
    await waitFor(() => {
      expect(upperChestSets(result.current)).toBeCloseTo(9.6, 2);
    });
    const heatBefore = result.current.detail.data?.heatPercent;

    await act(() => result.current.accept.mutateAsync(accept));

    await waitFor(() => {
      expect(upperChestSets(result.current)).toBeCloseTo(12.6, 2);
    });
    expect(fake.liveRows()).toHaveLength(1);
    expect(fake.liveRows()[0]).toMatchObject({ local_date: THURSDAY, routine_day_id: LEGS_DAY_ID });
    expect(result.current.detail.data?.weeklySets.planned).toBeCloseTo(12.6, 2);
    expect(result.current.detail.data?.heatPercent).toBe(heatBefore);
  });

  it("should replace the row when it is accepted a second time, leaving one live row and the same figure", async () => {
    const { fake, result } = open();
    await act(() => result.current.accept.mutateAsync(accept));
    const first = fake.liveRows()[0]?.["id"];

    await act(() => result.current.accept.mutateAsync(accept));

    await waitFor(() => {
      expect(upperChestSets(result.current)).toBeCloseTo(12.6, 2);
    });
    expect(fake.liveRows()).toHaveLength(1);
    expect(fake.liveRows()[0]?.["id"]).not.toBe(first);
    expect(fake.rows).toHaveLength(2);
  });

  it("should bring the projected sets back to 9.6 after Undo", async () => {
    const { result } = open();
    const stored = await act(() => result.current.accept.mutateAsync(accept));
    await waitFor(() => {
      expect(upperChestSets(result.current)).toBeCloseTo(12.6, 2);
    });

    await act(() => result.current.undo.mutateAsync(stored.id));

    await waitFor(() => {
      expect(upperChestSets(result.current)).toBeCloseTo(9.6, 2);
    });
    expect(result.current.detail.data?.weeklySets.planned).toBeCloseTo(9.6, 2);
  });
});
