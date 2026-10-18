import {
  COMPARE_PARAMS_V1,
  TRAINING_PARAMS_V1,
  compareWeek,
  muscleState,
  projectWeek,
  targetedMuscles,
} from "@keylow/core/training";
import { dehydrate, hydrate, onlineManager } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useMuscleState } from "../../src/hooks/useMuscleState";
import { useWeekComparison } from "../../src/hooks/useWeekComparison";
import { KeyLowProvider } from "../../src/KeyLowProvider";
import { keys } from "../../src/queryKeys";
import { createTestClient } from "../createTestClient";
import { createQueryClient } from "../support/queryClients";
import { installTrainingFake, routineRow, sessionRow, setRow } from "../support/training";
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

// Both times are on 17 October in London (BST), so they share the key of the start day.
const MORNING = "2026-10-17T07:00:00Z";
const EVENING = "2026-10-17T20:00:00Z";
const NEXT_DAY = "2026-10-18T09:00:00Z";
const START_DAY = "2026-10-02";
const WEEK_START = "2026-10-12";
const PLANNED_DAY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

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
  "readyAt",
  "volumeStatus",
  "weeklySets",
  "actualWeeklySets",
  "projectedWeeklySets",
  "gap",
];

describe("the training reads in a persisted cache", () => {
  const seed = () => {
    const session = sessionRow({ local_date: WEEK_START, routine_day_id: PLANNED_DAY_ID });
    return {
      sets: [
        setRow({ performed_at: "2026-10-16T18:00:00+00:00" }),
        setRow({ performed_at: "2026-10-12T18:00:00+00:00" }),
      ],
      sessions: [{ ...session, workout_sets: [setRow({ session_id: session.id })] }],
      routine: routineRow(),
    };
  };

  /** Opens the app online once, then returns what a persister would have stored. */
  const openOnline = async (data: ReturnType<typeof seed> = seed()) => {
    const fake = installTrainingFake(server, data);
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({ heat: useMuscleState(MORNING), week: useWeekComparison(WEEK_START) }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.heat.data).toBeDefined();
      expect(result.current.week.data).toBeDefined();
    });
    const rows = {
      sets: queryClient.getQueryData<TrainingSet[]>(keys.training.sets(START_DAY)),
      routine: queryClient.getQueryData<ActiveRoutine | null>(keys.training.activeRoutine),
      sessions: queryClient.getQueryData<WeekSession[]>(keys.training.weekSessions(WEEK_START)),
    };
    const stored = throughStorage(dehydrate(queryClient));
    return { fake, morning: result.current.heat.data, rows, stored };
  };

  it("should store rows only: no heat, ready time, volume, status or gap in any stored query", async () => {
    const { stored } = await openOnline();

    const training = stored.queries.filter(({ queryKey }) => queryKey[0] === "training");
    expect(training.map(({ queryKey }) => queryKey)).toEqual(
      expect.arrayContaining([
        keys.training.sets(START_DAY),
        keys.training.activeRoutine,
        keys.training.weekSessions(WEEK_START),
      ]),
    );
    for (const { state } of training) {
      for (const derived of DERIVED_NAMES) {
        expect(namesIn(state)).not.toContain(derived);
      }
    }
  });

  it("should compute heat at the current moment from the restored rows with the network down", async () => {
    const { fake, morning, rows, stored } = await openOnline();
    expect(rows.sets).toHaveLength(2);

    // A new session of the app: a new query client restored from storage, and no connection.
    const restored = createQueryClient({ defaultOptions: { queries: { retry: false } } });
    hydrate(restored, stored);
    fake.goOffline();
    onlineManager.setOnline(false);
    const requestsBefore = fake.requests.length;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <KeyLowProvider client={createTestClient()} queryClient={restored}>
        {children}
      </KeyLowProvider>
    );

    const { result } = renderHook(() => useMuscleState(EVENING), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    // Core, called directly on the rows that were stored (read back from storage), at the later moment.
    const storedRows = throughStorage(rows.sets ?? []);
    const expected = muscleState(
      storedRows,
      EVENING,
      TRAINING_PARAMS_V1,
      targetedMuscles({ routine: rows.routine ?? null }),
    );
    expect(result.current.data).toEqual(expected);
    // And it is not the heat of the morning, which is what a stored result would have shown.
    expect(result.current.data?.chest_lower.heat).toBeLessThan(morning?.chest_lower.heat ?? 0);
    expect(result.current.data?.chest_lower.readyAt).not.toBe(morning?.chest_lower.readyAt);
    expect(fake.requests).toHaveLength(requestsBefore);
  });

  it("should compute heat from the rows read the day before when restored on the next day with the network down", async () => {
    const { fake, rows, stored } = await openOnline();
    const restored = createQueryClient({ defaultOptions: { queries: { retry: false } } });
    hydrate(restored, stored);
    fake.goOffline();
    onlineManager.setOnline(false);
    const requestsBefore = fake.requests.length;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <KeyLowProvider client={createTestClient()} queryClient={restored}>
        {children}
      </KeyLowProvider>
    );

    // The next local day: its start day is not the key the rows are stored under.
    const { result } = renderHook(() => useMuscleState(NEXT_DAY), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(restored.getQueryData(keys.training.sets("2026-10-03"))).toBeUndefined();
    const expected = muscleState(
      throughStorage(rows.sets ?? []),
      NEXT_DAY,
      TRAINING_PARAMS_V1,
      targetedMuscles({ routine: rows.routine ?? null }),
    );
    expect(result.current.data).toEqual(expected);
    expect(result.current.data?.chest_lower.heat).toBeGreaterThan(0);
    expect(fake.requests).toHaveLength(requestsBefore);
  });

  describe("a routine made active on Thursday 15 October", () => {
    const ACTIVATED_AT = "2026-10-15T07:30:00+00:00";
    const ACTIVE_FROM = "2026-10-15";

    it("should store the instant it was made active and no date derived from it", async () => {
      const { stored } = await openOnline({
        ...seed(),
        routine: routineRow({ activated_at: ACTIVATED_AT }),
      });

      const routineKey = JSON.stringify(keys.training.activeRoutine);
      const storedRoutine = stored.queries.find(
        ({ queryKey }) => JSON.stringify(queryKey) === routineKey,
      );
      expect(storedRoutine?.state.data).toMatchObject({ activatedAt: ACTIVATED_AT });
      for (const query of stored.queries) {
        expect(namesIn(query.state.data)).not.toContain("activeFrom");
      }
    });

    it("should plan the whole week from a restored routine that has no activation field at all", async () => {
      // A routine cached by an older app, before the field existed: the stored value has no `activatedAt`.
      const { fake, rows, stored } = await openOnline({ ...seed(), sessions: [] });
      const oldRoutine = Object.fromEntries(
        Object.entries(rows.routine ?? {}).filter(([name]) => name !== "activatedAt"),
      );
      const routineKey = JSON.stringify(keys.training.activeRoutine);
      const withoutField = {
        ...stored,
        queries: stored.queries.map((query) =>
          JSON.stringify(query.queryKey) === routineKey
            ? { ...query, state: { ...query.state, data: oldRoutine } }
            : query,
        ),
      };
      const restored = createQueryClient({ defaultOptions: { queries: { retry: false } } });
      hydrate(restored, withoutField);
      fake.goOffline();
      onlineManager.setOnline(false);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <KeyLowProvider client={createTestClient()} queryClient={restored}>
          {children}
        </KeyLowProvider>
      );

      const { result } = renderHook(() => useWeekComparison(WEEK_START), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      expect(restored.getQueryData<object>(keys.training.activeRoutine)).not.toHaveProperty(
        "activatedAt",
      );
      expect(result.current.data?.chest_lower).toMatchObject({ projectedWeeklySets: 3 });
    });

    it("should compare the week as core does from the restored rows and the activation, with the network down", async () => {
      const { fake, rows, stored } = await openOnline({
        ...seed(),
        sessions: [],
        routine: routineRow({ activated_at: ACTIVATED_AT }),
      });
      const restored = createQueryClient({ defaultOptions: { queries: { retry: false } } });
      hydrate(restored, stored);
      fake.goOffline();
      onlineManager.setOnline(false);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <KeyLowProvider client={createTestClient()} queryClient={restored}>
          {children}
        </KeyLowProvider>
      );

      const { result } = renderHook(() => useWeekComparison(WEEK_START), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      const sessions = throughStorage(rows.sessions ?? []);
      const week = projectWeek(
        { ...throughStorage(rows.routine ?? { days: [] }), activeFrom: ACTIVE_FROM },
        WEEK_START,
        "Europe/London",
        { sessions, sets: sessions.flatMap((session) => session.sets) },
        COMPARE_PARAMS_V1,
      );
      expect(result.current.data).toEqual(
        compareWeek(week.actual, week.projected, COMPARE_PARAMS_V1),
      );
      // Monday's Push was never planned, so there is nothing to be behind on.
      expect(result.current.data?.chest_lower).toMatchObject({ projectedWeeklySets: 0, gap: 0 });
    });
  });

  /** A restore where the sets, the sessions and the zone came back but the routine did not (it was too old to keep). */
  const restoreWithoutRoutine = async () => {
    const { fake, stored } = await openOnline();
    const routineKey = JSON.stringify(keys.training.activeRoutine);
    const withoutRoutine = {
      ...stored,
      queries: stored.queries.filter(({ queryKey }) => JSON.stringify(queryKey) !== routineKey),
    };
    expect(withoutRoutine.queries).toHaveLength(stored.queries.length - 1);
    const restored = createQueryClient({ defaultOptions: { queries: { retry: false } } });
    hydrate(restored, withoutRoutine);
    fake.goOffline();
    onlineManager.setOnline(false);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <KeyLowProvider client={createTestClient()} queryClient={restored}>
        {children}
      </KeyLowProvider>
    );
    return { wrapper };
  };

  it("should stay pending offline when the sets were restored and the routine was not, so no muscle is shown as under", async () => {
    const { wrapper } = await restoreWithoutRoutine();

    const { result } = renderHook(() => useMuscleState(EVENING), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toMatchObject({ data: undefined, isPending: true, isError: false });
  });

  it("should stay pending offline when the week was restored and the routine was not, so it is not compared with an empty plan", async () => {
    const { wrapper } = await restoreWithoutRoutine();

    const { result } = renderHook(() => useWeekComparison(WEEK_START), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toMatchObject({ data: undefined, isPending: true, isError: false });
  });

  it("should stay pending offline for a week that was never cached, whatever other week is", async () => {
    const { fake, stored } = await openOnline();
    const restored = createQueryClient({ defaultOptions: { queries: { retry: false } } });
    hydrate(restored, stored);
    fake.goOffline();
    onlineManager.setOnline(false);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <KeyLowProvider client={createTestClient()} queryClient={restored}>
        {children}
      </KeyLowProvider>
    );

    const { result } = renderHook(() => useWeekComparison("2026-10-19"), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toMatchObject({ data: undefined, isPending: true });
  });

  it("should find the restored week on the next day, since its key is the week and not the time", async () => {
    const { fake, rows, stored } = await openOnline();
    const restored = createQueryClient({ defaultOptions: { queries: { retry: false } } });
    hydrate(restored, stored);
    fake.goOffline();
    onlineManager.setOnline(false);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <KeyLowProvider client={createTestClient()} queryClient={restored}>
        {children}
      </KeyLowProvider>
    );

    const { result } = renderHook(() => useWeekComparison(WEEK_START), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(restored.getQueryData(keys.training.weekSessions(WEEK_START))).toEqual(rows.sessions);
  });

  it("should compare the restored week with the network down", async () => {
    const { fake, rows, stored } = await openOnline();
    const restored = createQueryClient({ defaultOptions: { queries: { retry: false } } });
    hydrate(restored, stored);
    fake.goOffline();
    onlineManager.setOnline(false);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <KeyLowProvider client={createTestClient()} queryClient={restored}>
        {children}
      </KeyLowProvider>
    );

    const { result } = renderHook(() => useWeekComparison(WEEK_START), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const sessions = throughStorage(rows.sessions ?? []);
    const { actual, projected } = projectWeek(
      rows.routine ?? { days: [] },
      WEEK_START,
      "Europe/London",
      { sessions, sets: sessions.flatMap((session) => session.sets) },
      COMPARE_PARAMS_V1,
    );
    expect(result.current.data).toEqual(compareWeek(actual, projected, COMPARE_PARAMS_V1));
  });
});
