import { onlineManager } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useRoutineProgress } from "../../src/hooks/useRoutineProgress";
import { keys } from "../../src/queryKeys";
import { routineDetailRowSchema } from "../../src/repos/routineSchemas";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
import {
  DAY_ID,
  ROUTINE_ID,
  SECOND_DAY_ID,
  plannedExerciseRow,
  routineDetailRow,
} from "../support/routines";
import {
  TREND_EXERCISE_ID,
  TREND_OTHER_EXERCISE_ID,
  installTrendFake,
  trendRowOn,
  trendSetOf,
} from "../support/trend";
import { createWrapper } from "../support/wrapper";

import type { RoutineProgressDayItem } from "../../src/hooks/routineProgressTypes";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
const urlsAsked: string[] = [];
beforeEach(() => {
  urlsAsked.length = 0;
  server.events.on("request:start", ({ request }) => {
    urlsAsked.push(request.url);
  });
});
afterEach(() => {
  server.events.removeAllListeners();
  server.resetHandlers();
  onlineManager.setOnline(true);
});
afterAll(() => {
  server.close();
});

// 11:00 in London on Tuesday 20 October 2026. This week starts on Monday 19 October.
const NOW = new Date("2026-10-20T10:00:00Z");

const benchRow = (position: number) =>
  plannedExerciseRow({
    id: `dddddddd-dddd-4ddd-8ddd-00000000000${position}`,
    position,
    exercise_id: TREND_EXERCISE_ID,
    exercises: { id: TREND_EXERCISE_ID, name: "Bench press", equipment: "barbell" },
  });
const rowRow = plannedExerciseRow({
  id: "dddddddd-dddd-4ddd-8ddd-000000000009",
  exercise_id: TREND_OTHER_EXERCISE_ID,
  exercises: { id: TREND_OTHER_EXERCISE_ID, name: "Barbell row", equipment: "barbell" },
});

// Push twice, as the golden routine plans it, and a Pull day of an exercise never trained.
const routine = routineDetailRow({
  routine_days: [
    { id: DAY_ID, position: 0, weekday: 0, name: "Push", routine_exercises: [benchRow(0)] },
    { id: SECOND_DAY_ID, position: 1, weekday: 1, name: "Pull", routine_exercises: [rowRow] },
    {
      id: "cccccccc-cccc-4ccc-8ccc-eeeeeeeeeeee",
      position: 2,
      weekday: 5,
      name: "Push",
      routine_exercises: [benchRow(0)],
    },
  ],
});

// 60 x 8, 60 x 10, 60 x 8, a skipped week, then 62.5 x 6 this week.
const goldenSets = [
  trendRowOn("2026-09-21", TREND_EXERCISE_ID, 60, 8),
  trendRowOn("2026-09-29", TREND_EXERCISE_ID, 60, 10),
  trendRowOn("2026-10-06", TREND_EXERCISE_ID, 60, 8),
  trendRowOn("2026-10-19", TREND_EXERCISE_ID, 62.5, 6),
];

function installProgressFake({
  sets = goldenSets,
  weightUnit = "kg",
}: { sets?: unknown[]; weightUnit?: string } = {}) {
  const fake = installTrendFake(server, { routine, sets });
  server.use(
    http.get(`${REST_URL}/profiles`, ({ request }) =>
      postgrestRows(request, [{ timezone: "Europe/London", weight_unit: weightUnit }]),
    ),
  );
  return fake;
}

const renderProgress = (
  routineId: string | null = ROUTINE_ID,
  options: { enabled?: boolean; isOnline?: boolean; now?: Date } = {},
) => {
  const { queryClient, wrapper } = createWrapper();
  const hook = renderHook(
    (props: { now: Date }) =>
      useRoutineProgress(routineId ?? undefined, {
        enabled: options.enabled ?? true,
        now: props.now,
        ...(options.isOnline === undefined ? {} : { isOnline: options.isOnline }),
      }),
    { wrapper, initialProps: { now: options.now ?? NOW } },
  );
  return { ...hook, queryClient };
};

function readyDays(state: { status: string } & Record<string, unknown>) {
  if (state.status !== "ready") {
    throw new Error("expected the ready state");
  }
  return state["days"] as readonly RoutineProgressDayItem[];
}

describe("useRoutineProgress", () => {
  describe("until the reads are in", () => {
    it("should be loading, and not failed or unread, until every read is in", async () => {
      installProgressFake();

      const { result } = renderProgress();

      expect(result.current.state).toEqual({ status: "loading" });
      expect(result.current.notRead).toBe(false);
      await waitFor(() => {
        expect(result.current.state.status).toBe("ready");
      });
    });

    it("should be ready with no days, and read nothing at all, when there is no routine", async () => {
      installProgressFake();

      const { result } = renderProgress(null);

      expect(result.current.state).toEqual({ status: "ready", days: [] });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(urlsAsked).toEqual([]);
    });

    it("should read nothing while reads are not enabled, and not call it unread", async () => {
      installProgressFake();

      const { result } = renderProgress(ROUTINE_ID, { enabled: false, isOnline: false });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(result.current.state).toEqual({ status: "loading" });
      expect(urlsAsked).toEqual([]);
    });
  });

  describe("when the reads are in", () => {
    it("should give the golden bench row, the same row for each of the two Push days, in routine order", async () => {
      installProgressFake();

      const { result } = renderProgress();

      await waitFor(() => {
        expect(result.current.state.status).toBe("ready");
      });
      const days = readyDays(result.current.state);
      expect(days.map(({ name }) => name)).toEqual(["Push", "Pull", "Push"]);
      const [bench] = days[0]?.exercises ?? [];
      expect(bench).toMatchObject({
        exerciseId: TREND_EXERCISE_ID,
        name: "Bench press",
        line: "62.5 kg for 6 reps",
        change: { text: "+2.5 kg", direction: "up" },
        accessibleName: "Bench press, 62.5 kg for 6 reps, up 2.5 kg on the last trained week",
      });
      // The skipped week is a gap in the line, and the line is the last 8 weeks.
      expect(bench?.points).toEqual([null, null, null, 60, 60, 60, null, 62.5]);
      expect(days[2]?.exercises).toEqual(days[0]?.exercises);
      expect(days[1]?.exercises[0]).toMatchObject({
        line: "Not trained yet",
        change: null,
        points: [null, null, null, null, null, null, null, null],
      });
    });

    it("should say not trained this week, with the last value and no change, when this week is a gap", async () => {
      installProgressFake({ sets: goldenSets.slice(0, 3) });

      const { result } = renderProgress();

      await waitFor(() => {
        expect(result.current.state.status).toBe("ready");
      });
      const [bench] = readyDays(result.current.state)[0]?.exercises ?? [];
      expect(bench?.line).toBe("Not trained this week, last 60 kg for 8 reps");
      expect(bench?.change).toBeNull();
    });

    it("should write the loads in pounds for a profile that trains in pounds", async () => {
      installProgressFake({ weightUnit: "lb" });

      const { result } = renderProgress();

      await waitFor(() => {
        expect(result.current.state.status).toBe("ready");
      });
      const [bench] = readyDays(result.current.state)[0]?.exercises ?? [];
      expect(bench?.line).toBe("137.8 lb for 6 reps");
    });

    it("should keep the same days while the clock ticks inside the week", async () => {
      installProgressFake();
      const { result, rerender } = renderProgress();
      await waitFor(() => {
        expect(result.current.state.status).toBe("ready");
      });
      const firstDays = readyDays(result.current.state);

      rerender({ now: new Date("2026-10-20T10:01:00Z") });

      expect(readyDays(result.current.state)).toBe(firstDays);
    });
  });

  describe("when a read fails", () => {
    it("should be an error with a retry that reads again", async () => {
      const fake = installProgressFake();
      fake.failWith("XX000");

      const { result } = renderProgress();

      await waitFor(() => {
        expect(result.current.state.status).toBe("error");
      });
      fake.failWith(null);
      if (result.current.state.status !== "error") {
        throw new Error("expected the error state");
      }
      result.current.state.onRetry();
      await waitFor(() => {
        expect(result.current.state.status).toBe("ready");
      });
    });
  });

  describe("when the routine, the unit or the zone fails", () => {
    it.each([
      ["routine", "routines", "id"],
      ["weight unit", "profiles", "weight_unit"],
      ["time zone", "profiles", "timezone"],
    ])("should read the %s again on retry, not only the sets", async (_name, table, marker) => {
      installProgressFake();
      let isFailing = true;
      server.use(
        http.get(`${REST_URL}/${table}`, ({ request }) => {
          const isTheRead =
            table === "routines"
              ? true
              : new URL(request.url).searchParams.get("select") === marker;
          if (isFailing && isTheRead) {
            return postgrestError(500, "XX000", "down");
          }
          return table === "routines"
            ? postgrestRows(request, [routine])
            : postgrestRows(request, [{ timezone: "Europe/London", weight_unit: "kg" }]);
        }),
      );

      const { result } = renderProgress();

      await waitFor(() => {
        expect(result.current.state.status).toBe("error");
      });
      isFailing = false;
      if (result.current.state.status !== "error") {
        throw new Error("expected the error state");
      }
      result.current.state.onRetry();
      await waitFor(() => {
        expect(result.current.state.status).toBe("ready");
      });
    });
  });

  describe("offline", () => {
    const heldRows = { sets: [trendSetOf("2026-10-19", {}, TREND_EXERCISE_ID)], earlier: [] };

    function seedReads(queryClient: ReturnType<typeof createWrapper>["queryClient"], from: string) {
      queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
      queryClient.setQueryData(keys.profiles.weightUnit, "kg");
      queryClient.setQueryData(
        keys.training.routine(ROUTINE_ID),
        routineDetailRowSchema.parse(routine),
      );
      queryClient.setQueryData(keys.training.routineTrend(ROUTINE_ID, from), heldRows);
    }

    function renderOffline(
      seed: ((queryClient: ReturnType<typeof createWrapper>["queryClient"]) => void) | null,
    ) {
      onlineManager.setOnline(false);
      const { queryClient, wrapper } = createWrapper();
      seed?.(queryClient);
      return renderHook(
        () => useRoutineProgress(ROUTINE_ID, { enabled: true, now: NOW, isOnline: false }),
        { wrapper },
      );
    }

    it("should be not read, and never an endless loading, when nothing is held", async () => {
      installProgressFake();

      const { result } = renderOffline(null);

      await waitFor(() => {
        expect(result.current.notRead).toBe(true);
      });
      expect(urlsAsked).toEqual([]);
    });

    it("should show what is held as read when every read is held", async () => {
      installProgressFake();

      // This week's key, which is 12 weeks before Monday 19 October.
      const { result } = renderOffline((queryClient) => {
        seedReads(queryClient, "2026-07-27");
      });

      await waitFor(() => {
        expect(result.current.state.status).toBe("ready");
      });
      expect(result.current.notRead).toBe(false);
    });

    it("should show the rows of an earlier week's read until a connection brings this week's", async () => {
      installProgressFake();

      const { result } = renderOffline((queryClient) => {
        seedReads(queryClient, "2026-01-05");
      });

      await waitFor(() => {
        expect(result.current.state.status).toBe("ready");
      });
      expect(result.current.notRead).toBe(false);
    });

    it("should be not read when only some of the reads are held", async () => {
      installProgressFake();

      const { result } = renderOffline((queryClient) => {
        queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
      });

      await waitFor(() => {
        expect(result.current.notRead).toBe(true);
      });
    });

    it("should leave a section with no routine as it is, ready and read", () => {
      installProgressFake();
      onlineManager.setOnline(false);
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () => useRoutineProgress(undefined, { enabled: true, now: NOW, isOnline: false }),
        { wrapper },
      );

      expect(result.current).toEqual({ state: { status: "ready", days: [] }, notRead: false });
    });

    it("should never call a paused read unread when it is not told it is offline", async () => {
      installProgressFake();
      onlineManager.setOnline(false);
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () => useRoutineProgress(ROUTINE_ID, { enabled: true, now: NOW }),
        { wrapper },
      );

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(result.current).toEqual({ state: { status: "loading" }, notRead: false });
    });
  });
});
