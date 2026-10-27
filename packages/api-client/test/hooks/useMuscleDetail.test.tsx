import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useMuscleDetail } from "../../src/hooks/useMuscleDetail";
import { GOLDEN_WEEK_START, goldenWeekData } from "../support/goldenWeekRows";
import { installTrainingFake } from "../support/training";
import { createWrapper } from "../support/wrapper";

import type { MuscleId } from "@keylow/core/training";

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

const THURSDAY_EVENING = "2026-10-15T19:00:00+01:00";

const renderDetail = (muscle: MuscleId, view: "actual" | "projected" = "actual") => {
  const { wrapper } = createWrapper();
  return renderHook(
    () => useMuscleDetail(muscle, { view, weekStart: GOLDEN_WEEK_START, now: THURSDAY_EVENING }),
    { wrapper },
  );
};

describe("useMuscleDetail", () => {
  describe("the side delts on the golden Thursday at 19:00, as the muscle sheet board draws them", () => {
    it("should read 3 percent heat in step 0, ready now, with 5.5 of 11 sets this week", async () => {
      installTrainingFake(server, goldenWeekData);

      const { result } = renderDetail("delt_side");

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      expect(result.current.data).toMatchObject({
        heatPercent: 3,
        heatStep: 0,
        readyInHours: 0,
        weeklySets: {
          actual: 5.5,
          planned: 11,
          actualStatus: "growing",
          plannedStatus: "productive",
          volumeStatus: "growing",
          bands: { growingFromSets: 4, productiveFromSets: 10, highAboveSets: 20 },
        },
        targeting: { targeted: true, routineTrains: true, goalRanks: false },
      });
    });

    it("should name the routine day of the last session, Push on Monday 12 October", async () => {
      installTrainingFake(server, goldenWeekData);

      const { result } = renderDetail("delt_side");

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      expect(result.current.data?.lastTrained).toStrictEqual({
        localDate: "2026-10-12",
        sessionId: "00000004-0000-4000-8000-000000000001",
        routineDayName: "Push",
        exercises: [
          {
            exerciseId: "00000001-0000-4000-8000-000000000004",
            name: "Side Lateral Raise",
            sets: 4,
          },
          {
            exerciseId: "00000001-0000-4000-8000-000000000003",
            name: "Seated Barbell Military Press",
            sets: 3,
          },
        ],
      });
    });
  });

  it("should read the hamstrings at 55 percent, step 3, ready in 31 hours, last trained in Thursday's Legs", async () => {
    installTrainingFake(server, goldenWeekData);

    const { result } = renderDetail("hamstrings");

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data).toMatchObject({
      heatPercent: 55,
      heatStep: 3,
      readyInHours: 31,
      lastTrained: { localDate: "2026-10-15", routineDayName: "Legs" },
    });
  });

  it("should read the abs as not trained, with no last trained entry", async () => {
    installTrainingFake(server, goldenWeekData);

    const { result } = renderDetail("abs");

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data).toMatchObject({
      heatPercent: 0,
      weeklySets: { actual: 0, planned: 0, volumeStatus: "not_trained" },
      targeting: { targeted: false, routineTrains: false, goalRanks: false },
      lastTrained: null,
    });
  });

  it("should read the planned figure against the target in Projected without changing the actual one", async () => {
    installTrainingFake(server, goldenWeekData);

    const { result } = renderDetail("delt_side", "projected");

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.weeklySets).toMatchObject({
      actual: 5.5,
      planned: 11,
      volumeStatus: "productive",
    });
  });

  it("should make no request at all while enabled is false", async () => {
    const fake = installTrainingFake(server, goldenWeekData);
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useMuscleDetail("lats", {
          view: "actual",
          weekStart: GOLDEN_WEEK_START,
          now: THURSDAY_EVENING,
          enabled: false,
        }),
      { wrapper },
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.requests).toEqual([]);
    expect(result.current).toMatchObject({ data: undefined, isPending: true });
  });
});
