import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useBodyMap } from "../../src/hooks/useBodyMap";
import { useDashboardBodyMap } from "../../src/hooks/useDashboardBodyMap";
import { useMuscleDetail } from "../../src/hooks/useMuscleDetail";
import { useMuscleList } from "../../src/hooks/useMuscleList";
import { useWeekComparison } from "../../src/hooks/useWeekComparison";
import {
  THURSDAY,
  acceptedRow,
  installAcceptedSuggestionsFake,
} from "../support/acceptedSuggestions";
import { GOLDEN_WEEK_START, goldenSessions, goldenWeekData } from "../support/goldenWeekRows";
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

// The golden accepted suggestion of Zee's agreement on KEY-396: on Wednesday 14 October at 12:00 the
// V-taper user adds 3 sets of incline dumbbell press to Thursday's Legs. Monday and Tuesday are logged,
// Thursday's Legs and Saturday's Push are planned. The figures are those of core's golden
// (`acceptedSuggestions.golden.test.ts`): the week's projected upper chest sets go from 9.6 to 12.6, lower
// chest from 9.0 to 10.5, front delts from 12.0 to 13.5 and triceps from 15.0 to 16.5, and nothing else moves.
const WEDNESDAY_NOON = "2026-10-14T12:00:00+01:00";
const FRIDAY_NOON = "2026-10-16T12:00:00+01:00";

const sessionsBeforeThursday = goldenSessions.filter((session) => session.local_date < THURSDAY);
const wednesdayData = {
  ...goldenWeekData,
  sessions: sessionsBeforeThursday,
  sets: sessionsBeforeThursday.flatMap((session) => session.workout_sets),
};

const BY_THE_PRESS: MuscleId[] = ["chest_lower", "chest_upper", "delt_front", "triceps"];

const weekComparison = async (acceptedSuggestions: unknown[]) => {
  installTrainingFake(server, { ...wednesdayData, acceptedSuggestions });
  const { wrapper } = createWrapper();
  const { result } = renderHook(() => useWeekComparison(GOLDEN_WEEK_START), { wrapper });
  await waitFor(() => {
    expect(result.current.data).toBeDefined();
  });
  return result.current.data;
};

describe("an accepted suggestion in useWeekComparison", () => {
  it("should take the week's projected upper chest sets from 9.6 to 12.6, the golden figure", async () => {
    const without = await weekComparison([]);
    const withPress = await weekComparison([acceptedRow()]);

    expect(without?.chest_upper.projectedWeeklySets).toBeCloseTo(9.6, 2);
    expect(withPress?.chest_upper.projectedWeeklySets).toBeCloseTo(12.6, 2);
    expect(withPress?.chest_upper.actualWeeklySets).toBeCloseTo(4.8, 2);
    expect(withPress?.chest_upper.gap).toBeCloseTo(-7.8, 2);
  });

  it("should change the projected sets of the press's muscles and of no other", async () => {
    const without = await weekComparison([]);
    const withPress = await weekComparison([acceptedRow()]);

    const changed = Object.entries(withPress ?? {})
      .filter(
        ([muscle, comparison]) =>
          comparison.projectedWeeklySets !== without?.[muscle as MuscleId].projectedWeeklySets,
      )
      .map(([muscle]) => muscle)
      .sort();
    expect(changed).toEqual(BY_THE_PRESS);
    expect(withPress?.chest_lower.projectedWeeklySets).toBeCloseTo(10.5, 2);
    expect(withPress?.delt_front.projectedWeeklySets).toBeCloseTo(13.5, 2);
    expect(withPress?.triceps.projectedWeeklySets).toBeCloseTo(16.5, 2);
  });

  it("should leave a row that does not parse out of the projection", async () => {
    const without = await weekComparison([]);
    const withBroken = await weekComparison([acceptedRow({ params_version: "" })]);

    expect(withBroken).toEqual(without);
  });

  it("should wait for the accepted suggestions before it gives a comparison", async () => {
    installTrainingFake(server, { ...wednesdayData });
    const fake = installAcceptedSuggestionsFake(server, { rows: [acceptedRow()] });
    const release = fake.hold();
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeekComparison(GOLDEN_WEEK_START), { wrapper });

    await waitFor(() => {
      expect(fake.reads).toHaveLength(1);
    });
    expect(result.current).toMatchObject({ data: undefined, isPending: true });
    release();
    await waitFor(() => {
      expect(result.current.data?.chest_upper.projectedWeeklySets).toBeCloseTo(12.6, 2);
    });
  });

  it("should be an error that names the action and the code only when the accepted suggestions cannot be read", async () => {
    installTrainingFake(server, { ...wednesdayData });
    const fake = installAcceptedSuggestionsFake(server);
    fake.failReadsWith("42501");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeekComparison(GOLDEN_WEEK_START), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not load your accepted suggestions (42501)");
  });

  it("should ask for the accepted suggestions of the week asked for", async () => {
    installTrainingFake(server, { ...wednesdayData });
    const fake = installAcceptedSuggestionsFake(server);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeekComparison(GOLDEN_WEEK_START), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(fake.reads[0]?.searchParams.getAll("local_date")).toEqual([
      `gte.${GOLDEN_WEEK_START}`,
      "lte.2026-10-18",
    ]);
  });
});

const detailOf = async (
  view: "actual" | "projected",
  acceptedSuggestions: unknown[],
  now = WEDNESDAY_NOON,
  at?: string,
) => {
  installTrainingFake(server, { ...wednesdayData, acceptedSuggestions });
  const { wrapper } = createWrapper();
  const { result } = renderHook(
    () => useMuscleDetail("chest_upper", { view, weekStart: GOLDEN_WEEK_START, now, at }),
    { wrapper },
  );
  await waitFor(() => {
    expect(result.current.data).toBeDefined();
  });
  return result.current.data;
};

describe("an accepted suggestion in the muscle sheet, through useBodyMapRows", () => {
  it("should show the week's planned upper chest sets as 12.6 in Projected and the logged 4.8 as before", async () => {
    const withPress = await detailOf("projected", [acceptedRow()]);

    expect(withPress?.weeklySets.planned).toBeCloseTo(12.6, 2);
    expect(withPress?.weeklySets.actual).toBeCloseTo(4.8, 2);
  });

  it("should not change the Wednesday Projected heat: planned sets count from the day after", async () => {
    const without = await detailOf("projected", []);
    const withPress = await detailOf("projected", [acceptedRow()]);

    expect(withPress?.heatPercent).toBe(without?.heatPercent);
    expect(withPress?.readyInHours).toBe(without?.readyInHours);
  });

  it("should raise the Friday Projected heat, since the press counts from the day after Thursday", async () => {
    const without = await detailOf("projected", [], FRIDAY_NOON);
    const withPress = await detailOf("projected", [acceptedRow()], FRIDAY_NOON);

    expect(withPress?.heatPercent).toBeGreaterThan(without?.heatPercent ?? 0);
  });

  it("should leave Actual heat and the logged sets alone", async () => {
    const without = await detailOf("actual", []);
    const withPress = await detailOf("actual", [acceptedRow()]);

    expect(withPress?.heatPercent).toBe(without?.heatPercent);
    expect(withPress?.readyInHours).toBe(without?.readyInHours);
    expect(withPress?.weeklySets.actual).toBe(without?.weeklySets.actual);
    expect(withPress?.lastTrained).toEqual(without?.lastTrained);
  });
});

describe("an accepted suggestion in the body map", () => {
  const bodyMap = async (
    input: Parameters<typeof useBodyMap>[0],
    acceptedSuggestions: unknown[],
  ) => {
    installTrainingFake(server, { ...wednesdayData, acceptedSuggestions });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBodyMap(input), { wrapper });
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    return result.current.data;
  };

  it("should not change the Wednesday Projected heat of any muscle", async () => {
    const input = {
      scale: "heat",
      view: "projected",
      weekStart: GOLDEN_WEEK_START,
      now: WEDNESDAY_NOON,
    } as const;

    expect((await bodyMap(input, [acceptedRow()]))?.values).toEqual(
      (await bodyMap(input, []))?.values,
    );
  });

  it("should leave the gap so far alone until Thursday is over", async () => {
    const input = {
      scale: "gap",
      view: "projected",
      weekStart: GOLDEN_WEEK_START,
      now: WEDNESDAY_NOON,
    } as const;

    expect((await bodyMap(input, [acceptedRow()]))?.values).toEqual(
      (await bodyMap(input, []))?.values,
    );
  });

  it("should move the volume Projected of the press's muscles and no other", async () => {
    const input = {
      scale: "volume",
      view: "projected",
      weekStart: GOLDEN_WEEK_START,
      now: WEDNESDAY_NOON,
    } as const;
    const without = await bodyMap(input, []);

    const withPress = await bodyMap(input, [acceptedRow()]);

    const changed = Object.entries(withPress?.values ?? {})
      .filter(([muscle, value]) => value !== without?.values[muscle as MuscleId])
      .map(([muscle]) => muscle);
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.every((muscle) => BY_THE_PRESS.includes(muscle as MuscleId))).toBe(true);
  });

  it("should leave the dashboard card, which is Actual heat now, alone", async () => {
    const fake = installTrainingFake(server, {
      ...wednesdayData,
      acceptedSuggestions: [acceptedRow()],
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDashboardBodyMap({ now: WEDNESDAY_NOON }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(fake.requestsTo("accepted_suggestions")).toEqual([]);
  });

  it("should list the muscles in Projected with the press counted", async () => {
    installTrainingFake(server, { ...wednesdayData, acceptedSuggestions: [acceptedRow()] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useMuscleList({ view: "projected", weekStart: GOLDEN_WEEK_START, now: FRIDAY_NOON }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.isError).toBe(false);
  });
});
