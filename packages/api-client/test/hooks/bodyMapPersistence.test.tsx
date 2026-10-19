import {
  COMPARE_PARAMS_V1,
  TRAINING_PARAMS_V1,
  heatValues,
  muscleListGroups,
  muscleState,
  projectWeek,
  projectedState,
  targetedMuscles,
  weekPlanDays,
} from "@keylow/core/training";
import { dehydrate, hydrate, onlineManager } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useBodyMap } from "../../src/hooks/useBodyMap";
import { useDashboardBodyMap } from "../../src/hooks/useDashboardBodyMap";
import { useMuscleList } from "../../src/hooks/useMuscleList";
import { KeyLowProvider } from "../../src/KeyLowProvider";
import { keys } from "../../src/queryKeys";
import { createTestClient } from "../createTestClient";
import { GOLDEN_WEEK_START, goldenWeekData } from "../support/goldenWeekRows";
import { createQueryClient } from "../support/queryClients";
import { installTrainingFake } from "../support/training";
import { createWrapper } from "../support/wrapper";

import type { ActiveRoutine, TrainingSet, WeekSession } from "../../src";
import type { ReactNode } from "react";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
  onlineManager.setOnline(true);
});
afterAll(() => {
  server.close();
});

const THURSDAY_EVENING = "2026-10-15T19:00:00+01:00";
const SATURDAY_NOON = "2026-10-17T12:00:00+01:00";
// The sets are read from 15 days before the Monday of the week.
const START_DAY = "2026-09-27";

// What a persister does to a cache: it goes to storage as text and comes back as the same plain data.
const throughStorage = <Value,>(value: Value): Value =>
  // A cache holds plain JSON data only, which the text form keeps exactly.
  JSON.parse(JSON.stringify(value)) as Value;

/** Every property name anywhere in a stored value. */
const namesIn = (value: unknown): string[] =>
  typeof value !== "object" || value === null
    ? []
    : Object.entries(value).flatMap(([name, inner]) => [name, ...namesIn(inner)]);

const DERIVED_NAMES = [
  "heat",
  "heatStep",
  "heatPercent",
  "readyAt",
  "readyInHours",
  "volumeStatus",
  "weeklySets",
  "actualWeeklySets",
  "projectedWeeklySets",
  "gap",
  "status",
  "values",
  "warmest",
  "percent",
];

describe("the body map in a persisted cache", () => {
  /** Opens the app online once on Thursday evening, then returns what a persister would have stored. */
  const openOnline = async (data: Parameters<typeof installTrainingFake>[1] = goldenWeekData) => {
    const fake = installTrainingFake(server, data);
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({
        actual: useBodyMap({
          scale: "heat",
          view: "actual",
          weekStart: GOLDEN_WEEK_START,
          now: THURSDAY_EVENING,
        }),
        projected: useBodyMap({
          scale: "gap",
          view: "projected",
          weekStart: GOLDEN_WEEK_START,
          now: THURSDAY_EVENING,
        }),
        list: useMuscleList({
          view: "projected",
          weekStart: GOLDEN_WEEK_START,
          now: THURSDAY_EVENING,
        }),
        card: useDashboardBodyMap({ now: THURSDAY_EVENING }),
      }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.actual.data).toBeDefined();
      expect(result.current.projected.data).toBeDefined();
      expect(result.current.list.data).toBeDefined();
      expect(result.current.card.data).toBeDefined();
    });
    const rows = {
      sets: queryClient.getQueryData<TrainingSet[]>(keys.training.sets(START_DAY)),
      routine: queryClient.getQueryData<ActiveRoutine | null>(keys.training.activeRoutine),
      sessions: queryClient.getQueryData<WeekSession[]>(
        keys.training.weekSessions(GOLDEN_WEEK_START),
      ),
    };
    return {
      fake,
      thursdayHeat: result.current.actual.data?.values,
      rows,
      stored: throughStorage(dehydrate(queryClient)),
    };
  };

  /** A new session of the app: a query client restored from storage, and no connection. */
  const reopenOffline = (
    fake: ReturnType<typeof installTrainingFake>,
    stored: ReturnType<typeof dehydrate>,
  ) => {
    const restored = createQueryClient({ defaultOptions: { queries: { retry: false } } });
    hydrate(restored, stored);
    fake.goOffline();
    onlineManager.setOnline(false);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <KeyLowProvider client={createTestClient()} queryClient={restored}>
        {children}
      </KeyLowProvider>
    );
    return { wrapper };
  };

  it("should store rows only: no heat, step, ready time, status, value or percent in any stored query", async () => {
    const { stored } = await openOnline();

    const training = stored.queries.filter(({ queryKey }) => queryKey[0] === "training");
    expect(training.map(({ queryKey }) => queryKey)).toEqual(
      expect.arrayContaining([
        keys.training.sets(START_DAY),
        keys.training.activeRoutine,
        keys.training.weekSessions(GOLDEN_WEEK_START),
      ]),
    );
    for (const { state } of training) {
      for (const derived of DERIVED_NAMES) {
        expect(namesIn(state.data)).not.toContain(derived);
      }
    }
  });

  it("should show the body map, as with no goal, from a cache saved before the goal was kept, with the network down", async () => {
    const { fake, stored } = await openOnline();
    const withoutGoal = {
      ...stored,
      queries: stored.queries.filter(
        ({ queryKey }) => JSON.stringify(queryKey) !== JSON.stringify(keys.training.goals),
      ),
    };
    expect(withoutGoal.queries).toHaveLength(stored.queries.length - 1);
    const { wrapper } = reopenOffline(fake, withoutGoal);

    const { result } = renderHook(
      () =>
        useBodyMap({
          scale: "heat",
          view: "actual",
          weekStart: GOLDEN_WEEK_START,
          now: SATURDAY_NOON,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
  });

  it("should work out the heat at a later moment from the restored rows with the network down", async () => {
    const { fake, thursdayHeat, rows, stored } = await openOnline();
    const { wrapper } = reopenOffline(fake, stored);
    const requestsBefore = fake.requests.length;

    const { result } = renderHook(
      () =>
        useBodyMap({
          scale: "heat",
          view: "actual",
          weekStart: GOLDEN_WEEK_START,
          now: SATURDAY_NOON,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    // Core, called directly on the rows that were stored (read back from storage), at the later moment.
    const expected = heatValues(
      muscleState(
        throughStorage(rows.sets ?? []),
        SATURDAY_NOON,
        TRAINING_PARAMS_V1,
        targetedMuscles({ routine: rows.routine ?? null }),
      ),
    );
    expect(result.current.data?.values).toStrictEqual(expected);
    expect(result.current.data?.computedAt).toBe(SATURDAY_NOON);
    // And it is not the heat of Thursday evening, which is what a stored result would have shown.
    expect(result.current.data?.values).not.toStrictEqual(thursdayHeat);
    expect(fake.requests).toHaveLength(requestsBefore);
  });

  it("should work out Projected heat at a later moment from the restored rows with the network down", async () => {
    const { fake, rows, stored } = await openOnline();
    const { wrapper } = reopenOffline(fake, stored);

    const { result } = renderHook(
      () =>
        useBodyMap({
          scale: "heat",
          view: "projected",
          at: "2026-10-18",
          weekStart: GOLDEN_WEEK_START,
          now: SATURDAY_NOON,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const sessions = throughStorage(rows.sessions ?? []);
    const projection = projectWeek(
      rows.routine ?? { days: [] },
      GOLDEN_WEEK_START,
      "Europe/London",
      { sessions, sets: sessions.flatMap((session) => session.sets) },
      COMPARE_PARAMS_V1,
    );
    expect(result.current.data?.values).toStrictEqual(
      heatValues(
        projectedState(
          projection.projected,
          "2026-10-18T19:00:00.000Z",
          "Europe/London",
          COMPARE_PARAMS_V1,
          targetedMuscles({ routine: rows.routine ?? null }),
        ),
      ),
    );
  });

  it("should work out the dashboard card from the restored rows with the network down", async () => {
    const { fake, rows, stored } = await openOnline();
    const { wrapper } = reopenOffline(fake, stored);

    const { result } = renderHook(() => useDashboardBodyMap({ now: SATURDAY_NOON }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.values).toStrictEqual(
      heatValues(
        muscleState(
          throughStorage(rows.sets ?? []),
          SATURDAY_NOON,
          TRAINING_PARAMS_V1,
          targetedMuscles({ routine: rows.routine ?? null }),
        ),
      ),
    );
  });

  it("should draw the list in the next week from the rows read the week before, with the network down", async () => {
    const { fake, rows, stored } = await openOnline();
    const { wrapper } = reopenOffline(fake, stored);
    const nextWeekMonday = "2026-10-19T09:00:00+01:00";

    const { result } = renderHook(
      () =>
        useMuscleList({
          view: "actual",
          weekStart: "2026-10-19",
          now: nextWeekMonday,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data).toStrictEqual(
      muscleListGroups(
        muscleState(
          throughStorage(rows.sets ?? []),
          nextWeekMonday,
          TRAINING_PARAMS_V1,
          targetedMuscles({ routine: rows.routine ?? null }),
        ),
        nextWeekMonday,
      ),
    );
  });

  describe("a routine made active on Thursday 15 October", () => {
    const ACTIVATED_AT = "2026-10-15T07:30:00+00:00";
    const nothingLoggedFromThursday = () => ({
      ...goldenWeekData,
      sets: [],
      sessions: [],
      routine: { ...goldenWeekData.routine, activated_at: ACTIVATED_AT },
    });

    it("should store the instant it was made active and no date derived from it", async () => {
      const { stored } = await openOnline(nothingLoggedFromThursday());

      const routineKey = JSON.stringify(keys.training.activeRoutine);
      const storedRoutine = stored.queries.find(
        ({ queryKey }) => JSON.stringify(queryKey) === routineKey,
      );
      expect(storedRoutine?.state.data).toMatchObject({ activatedAt: ACTIVATED_AT });
      for (const query of stored.queries) {
        expect(namesIn(query.state.data)).not.toContain("activeFrom");
      }
    });

    it("should plan from it at a later moment from the restored rows with the network down", async () => {
      const { fake, rows, stored } = await openOnline(nothingLoggedFromThursday());
      const { wrapper } = reopenOffline(fake, stored);
      const requestsBefore = fake.requests.length;

      const { result } = renderHook(
        () =>
          useBodyMap({
            scale: "gap",
            view: "projected",
            weekStart: GOLDEN_WEEK_START,
            now: SATURDAY_NOON,
          }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      // Core, called directly on the rows that were stored, with the day the routine was made active on.
      const week = weekPlanDays({
        routine: {
          ...throughStorage(rows.routine ?? { name: "", days: [] }),
          activeFrom: "2026-10-15",
        },
        sessions: [],
        now: SATURDAY_NOON,
        tz: "Europe/London",
        weekStart: GOLDEN_WEEK_START,
      });
      expect(result.current.data?.days.map((day) => day.status)).toStrictEqual(
        week.days.map((day) => day.status),
      );
      expect(result.current.data?.days.slice(0, 3).map((day) => day.status)).toStrictEqual([
        "rest",
        "rest",
        "rest",
      ]);
      // Chest is Monday's Push, never planned, so on plan. Quads is Thursday's Legs, missed, so behind.
      expect(result.current.data?.values.chest_lower).toBe(1);
      expect(result.current.data?.values.quads).toBe(0);
      expect(fake.requests).toHaveLength(requestsBefore);
    });
  });

  it("should stay pending offline for a week that was never cached, when the number needs the week", async () => {
    const { fake, stored } = await openOnline();
    const { wrapper } = reopenOffline(fake, stored);

    const { result } = renderHook(
      () =>
        useBodyMap({
          scale: "volume",
          view: "actual",
          weekStart: "2026-10-19",
          now: "2026-10-19T09:00:00+01:00",
        }),
      { wrapper },
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toMatchObject({ data: undefined, isPending: true, isError: false });
  });

  it("should stay pending offline when the rows came back and the routine did not, so no muscle is shown as under", async () => {
    const { fake, stored } = await openOnline();
    const routineKey = JSON.stringify(keys.training.activeRoutine);
    const withoutRoutine = {
      ...stored,
      queries: stored.queries.filter(({ queryKey }) => JSON.stringify(queryKey) !== routineKey),
    };
    expect(withoutRoutine.queries).toHaveLength(stored.queries.length - 1);
    const { wrapper } = reopenOffline(fake, withoutRoutine);

    const { result } = renderHook(
      () =>
        useBodyMap({
          scale: "heat",
          view: "actual",
          weekStart: GOLDEN_WEEK_START,
          now: SATURDAY_NOON,
        }),
      { wrapper },
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toMatchObject({ data: undefined, isPending: true, isError: false });
  });
});
