import { onlineManager } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { useExerciseProgress } from "../../src/hooks/useExerciseProgress";
import { keys } from "../../src/queryKeys";
import { REST_URL, postgrestRows } from "../support/postgrest";
import { TREND_EXERCISE_ID, installTrendFake, trendRowOn } from "../support/trend";
import { createWrapper } from "../support/wrapper";

import type { TrendRange } from "@keylow/core/training";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  vi.useRealTimers();
  server.resetHandlers();
  onlineManager.setOnline(true);
});
afterAll(() => {
  server.close();
});

// 11:00 in London on Tuesday 20 October 2026. This week starts on Monday 19 October.
const NOW = new Date("2026-10-20T10:00:00Z");
const NAME = "Bench press";

// 60 x 8, 60 x 10, 60 x 8, a skipped week, then 62.5 x 6 this week.
const goldenSets = [
  trendRowOn("2026-09-21", TREND_EXERCISE_ID, 60, 8),
  trendRowOn("2026-09-29", TREND_EXERCISE_ID, 60, 10),
  trendRowOn("2026-10-06", TREND_EXERCISE_ID, 60, 8),
  trendRowOn("2026-10-19", TREND_EXERCISE_ID, 62.5, 6),
];

function installProgressFake(
  sets: unknown[] = goldenSets,
  { weightUnit = "kg", exerciseName = NAME }: { weightUnit?: string; exerciseName?: string } = {},
) {
  const fake = installTrendFake(server, { sets });
  server.use(
    http.get(`${REST_URL}/profiles`, ({ request }) =>
      postgrestRows(request, [{ timezone: "Europe/London", weight_unit: weightUnit }]),
    ),
    http.get(`${REST_URL}/exercises`, ({ request }) =>
      postgrestRows(request, [
        {
          id: TREND_EXERCISE_ID,
          name: exerciseName,
          equipment: "barbell",
          mechanic: "compound",
          source: "free_exercise_db",
          exercise_muscles: [{ muscle_id: "triceps", role: "primary", weight: 1 }],
        },
      ]),
    ),
  );
  return fake;
}

type ProgressProps = { range: TrendRange; now: Date };

const renderProgress = (initialRange: TrendRange = "3m") => {
  const { queryClient, wrapper } = createWrapper();
  const hook = renderHook(
    ({ range }) => useExerciseProgress(TREND_EXERCISE_ID, range, { enabled: true, now: NOW }),
    { wrapper, initialProps: { range: initialRange } },
  );
  return { ...hook, queryClient };
};

describe("useExerciseProgress", () => {
  it("should plainly title the exercise and say loading until the rows are read", () => {
    installProgressFake();

    const { result } = renderProgress();

    expect(result.current.title).toBe("Exercise progress");
    expect(result.current.body).toEqual({ status: "loading" });
    expect(result.current.shownRange).toBeNull();
    expect(result.current.readAt).toBeNull();
  });

  it("should give the golden bench weeks newest first, with the skipped week as a gap", async () => {
    installProgressFake();

    const { result } = renderProgress();

    await waitFor(() => {
      expect(result.current.body.status).toBe("ready");
    });
    const { body, title } = result.current;
    if (body.status !== "ready") {
      throw new Error("expected the ready body");
    }
    expect(title).toBe(NAME);
    expect(
      body.weeks.slice(0, 3).map(({ weekLabel, value, hasPoint }) => [weekLabel, value, hasPoint]),
    ).toEqual([
      ["Mon 19 Oct", "62.5 kg for 6 reps", true],
      ["Mon 12 Oct", null, false],
      ["Mon 5 Oct", "60 kg for 8 reps", true],
    ]);
    expect(body.weeks[0]?.change).toEqual({ text: "+2.5 kg", direction: "up" });
    expect(body.weeks[1]?.accessibleName).toBe("Mon 12 Oct, Not trained");
    expect(body.chart.unit).toBe("kg");
    expect(body.chart.label).toBe(NAME);
    expect(body.chart.points.at(-2)).toEqual({ week: "2026-10-12", value: null });
    expect(body.needsSecondWeek).toBe(false);
  });

  it("should write the loads in pounds for a profile that trains in pounds", async () => {
    installProgressFake(goldenSets, { weightUnit: "lb" });

    const { result } = renderProgress();

    await waitFor(() => {
      expect(result.current.body.status).toBe("ready");
    });
    const { body } = result.current;
    if (body.status !== "ready") {
      throw new Error("expected the ready body");
    }
    expect(body.chart.unit).toBe("lb");
    expect(body.weeks[0]?.value).toBe("137.8 lb for 6 reps");
  });

  it("should ask for a second week when the exercise was trained in one week only", async () => {
    installProgressFake([trendRowOn("2026-10-19", TREND_EXERCISE_ID, 60, 8)]);

    const { result } = renderProgress("4w");

    await waitFor(() => {
      expect(result.current.body.status).toBe("ready");
    });
    const { body } = result.current;
    if (body.status !== "ready") {
      throw new Error("expected the ready body");
    }
    expect(body.needsSecondWeek).toBe(true);
  });

  it("should be empty when no set is in the range", async () => {
    installProgressFake([]);

    const { result } = renderProgress();

    await waitFor(() => {
      expect(result.current.body).toEqual({ status: "empty" });
    });
  });

  it("should tell when the rows were read", async () => {
    installProgressFake();
    const before = Date.now();

    const { result } = renderProgress();

    await waitFor(() => {
      expect(result.current.body.status).toBe("ready");
    });
    const readAt = result.current.readAt;
    expect(readAt).not.toBeNull();
    expect(readAt?.getTime()).toBeGreaterThanOrEqual(before);
    expect(readAt?.getTime()).toBeLessThanOrEqual(Date.now());
    expect(result.current.timeZone).toBe("Europe/London");
  });

  it("should keep the rows on show, and say which range they are for, while a longer range is read", async () => {
    installProgressFake();
    const { result, rerender } = renderProgress("4w");
    await waitFor(() => {
      expect(result.current.body.status).toBe("ready");
    });

    // A longer range starts earlier than the rows held, so it has to be read.
    rerender({ range: "3m" });

    expect(result.current.body.status).toBe("ready");
    expect(result.current.shownRange).toBe("4w");
    await waitFor(() => {
      expect(result.current.shownRange).toBe("3m");
    });
  });

  it("should be an error with a retry when the rows cannot be read", async () => {
    const fake = installProgressFake();
    fake.failWith("XX000");

    const { result } = renderProgress();

    await waitFor(() => {
      expect(result.current.body.status).toBe("error");
    });
    fake.failWith(null);
    if (result.current.body.status !== "error") {
      throw new Error("expected the error body");
    }
    result.current.body.onRetry();
    await waitFor(() => {
      expect(result.current.body.status).toBe("ready");
    });
  });

  it("should read nothing while reads are not enabled", () => {
    const fake = installProgressFake();
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useExerciseProgress(TREND_EXERCISE_ID, "3m", { enabled: false, now: NOW }),
      { wrapper },
    );

    expect(result.current.body).toEqual({ status: "loading" });
    expect(fake.requests).toHaveLength(0);
  });

  describe("when the rows were read", () => {
    it("should move on when a refetch returns the same rows", async () => {
      installProgressFake();
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-20T10:00:00Z"));
      const { result, queryClient } = renderProgress();
      await waitFor(() => {
        expect(result.current.body.status).toBe("ready");
      });
      const firstRows = result.current.body;
      expect(result.current.readAt).toEqual(new Date("2026-10-20T10:00:00Z"));

      vi.setSystemTime(new Date("2026-10-20T10:45:00Z"));
      await queryClient.refetchQueries({ queryKey: keys.training.exerciseTrendAll });

      await waitFor(() => {
        expect(result.current.readAt).toEqual(new Date("2026-10-20T10:45:00Z"));
      });
      expect(result.current.body.status).toBe(firstRows.status);
    });

    it("should keep the refetch time of the rows on show while a longer range is read", async () => {
      installProgressFake();
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-20T10:00:00Z"));
      const { result, queryClient, rerender } = renderProgress("4w");
      await waitFor(() => {
        expect(result.current.body.status).toBe("ready");
      });
      vi.setSystemTime(new Date("2026-10-20T10:45:00Z"));
      await queryClient.refetchQueries({ queryKey: keys.training.exerciseTrendAll });
      await waitFor(() => {
        expect(result.current.readAt).toEqual(new Date("2026-10-20T10:45:00Z"));
      });

      // A longer range starts before the rows held, so it is read, and the read never answers.
      server.use(http.get(`${REST_URL}/workout_sets`, () => new Promise(() => undefined)));
      rerender({ range: "3m" });

      expect(result.current.shownRange).toBe("4w");
      expect(result.current.readAt).toEqual(new Date("2026-10-20T10:45:00Z"));
    });

    it("should be the time of the read the standing in rows came from, not the newest read", async () => {
      installProgressFake();
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-20T10:00:00Z"));
      const { wrapper, queryClient } = createWrapper();
      const initialProps: ProgressProps = { range: "1y", now: NOW };
      const { result, rerender } = renderHook(
        ({ range, now }: ProgressProps) =>
          useExerciseProgress(TREND_EXERCISE_ID, range, { enabled: true, now }),
        { wrapper, initialProps },
      );
      await waitFor(() => {
        expect(result.current.body.status).toBe("ready");
      });
      const fourWeekKey = keys.training.exerciseTrend(TREND_EXERCISE_ID, "2026-09-28");
      vi.setSystemTime(new Date("2026-10-20T10:30:00Z"));
      rerender({ range: "4w", now: NOW });
      await waitFor(() => {
        expect(queryClient.getQueryState(fourWeekKey)?.dataUpdatedAt).toBe(
          new Date("2026-10-20T10:30:00Z").getTime(),
        );
      });

      // A week on and offline, 3 months starts after the 1 year read and before the 4 week read, so the
      // 1 year rows stand in. The newest read of the exercise is the 4 week one, which is not theirs.
      onlineManager.setOnline(false);
      rerender({ range: "3m", now: new Date("2026-10-27T10:00:00Z") });

      await waitFor(() => {
        expect(result.current.shownRange).toBe("3m");
      });
      expect(result.current.readAt).toEqual(new Date("2026-10-20T10:00:00Z"));
    });
  });

  describe("notRead", () => {
    const renderOffline = (range: TrendRange, isOnline: boolean) => {
      const { wrapper } = createWrapper();
      return renderHook(
        (props: { range: TrendRange; isOnline: boolean }) =>
          useExerciseProgress(TREND_EXERCISE_ID, props.range, {
            enabled: true,
            now: NOW,
            isOnline: props.isOnline,
          }),
        { wrapper, initialProps: { range, isOnline } },
      );
    };

    it("should be false online, while a read is still going", () => {
      installProgressFake();

      const { result } = renderOffline("3m", true);

      expect(result.current.body.status).toBe("loading");
      expect(result.current.notRead).toBe(false);
    });

    it("should be true offline with nothing read", () => {
      installProgressFake();
      onlineManager.setOnline(false);

      const { result } = renderOffline("3m", false);

      expect(result.current.body.status).toBe("loading");
      expect(result.current.notRead).toBe(true);
    });

    it("should be false for the rows on show, and true for a range never read, once offline", async () => {
      installProgressFake();
      const { result, rerender } = renderOffline("4w", true);
      await waitFor(() => {
        expect(result.current.body.status).toBe("ready");
      });
      onlineManager.setOnline(false);
      rerender({ range: "4w", isOnline: false });
      expect(result.current.notRead).toBe(false);

      rerender({ range: "1y", isOnline: false });

      expect(result.current.body.status).toBe("ready");
      expect(result.current.shownRange).toBe("4w");
      expect(result.current.notRead).toBe(true);
    });

    it("should be true offline when the rows are on show but the unit read failed", async () => {
      installProgressFake();
      server.use(
        http.get(`${REST_URL}/profiles`, ({ request }) =>
          new URL(request.url).searchParams.get("select") === "weight_unit"
            ? new Response(JSON.stringify({ code: "XX000", message: "failed" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
              })
            : postgrestRows(request, [{ timezone: "Europe/London" }]),
        ),
      );
      const { result, rerender } = renderOffline("3m", true);
      await waitFor(() => {
        expect(result.current.body.status).toBe("error");
      });
      expect(result.current.shownRange).toBe("3m");
      expect(result.current.notRead).toBe(false);

      rerender({ range: "3m", isOnline: false });

      expect(result.current.notRead).toBe(true);
    });

    it("should be false when isOnline is not given, as it is on the phone", () => {
      installProgressFake();
      onlineManager.setOnline(false);
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () => useExerciseProgress(TREND_EXERCISE_ID, "3m", { enabled: true, now: NOW }),
        { wrapper },
      );

      expect(result.current.notRead).toBe(false);
    });
  });
});
