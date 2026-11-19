import { describe, expect, it } from "vitest";

import { aDay, aStats } from "./builders";
import {
  streakDaysOf,
  trainingWeeksOf,
  trainingWeeksThroughOf,
  weighInWeeksOf,
} from "../../src/achievements/streakInputs";

const week = (weekStart: string, sessionCount: number) => ({
  weekStart,
  sessionCount,
  primaryMuscleGroups: [],
});

const goal = (daysPerWeek: number, effectiveFrom: string, effectiveTo: string | null) => ({
  daysPerWeek,
  effectiveFrom,
  effectiveTo,
});

describe("streakDaysOf", () => {
  it("should carry the four fields the streak reads", () => {
    const days = streakDaysOf(aStats({ days: [aDay("2026-11-18", { entryCount: 4 })] }));

    expect(days).toEqual([
      {
        localDate: "2026-11-18",
        isComplete: true,
        completedAt: "2026-11-18T21:00:00+00:00",
        entryCount: 4,
      },
    ]);
  });
});

describe("trainingWeeksOf", () => {
  const weeks = [week("2026-11-02", 3), week("2026-11-09", 3)];

  it("should plan the days per week of the goal in force on that Monday", () => {
    const stats = aStats({
      workouts: { ...aStats().workouts, weeks },
      trainingGoals: [goal(2, "2026-10-01", "2026-11-09"), goal(4, "2026-11-09", null)],
      activeRoutineDayCount: 5,
    });

    expect(trainingWeeksOf(stats).map((record) => record.required)).toEqual([2, 4]);
  });

  it("should plan the new goal's days on the Monday the old goal ends and the new one starts", () => {
    const stats = aStats({
      workouts: { ...aStats().workouts, weeks: [week("2026-11-09", 3)] },
      trainingGoals: [goal(2, "2026-10-01", "2026-11-09"), goal(4, "2026-11-09", null)],
    });

    expect(trainingWeeksOf(stats).map((record) => record.required)).toEqual([4]);
  });

  it("should not plan a goal on the Monday it ends when no goal follows it", () => {
    const stats = aStats({
      workouts: { ...aStats().workouts, weeks: [week("2026-11-09", 3)] },
      trainingGoals: [goal(2, "2026-10-01", "2026-11-09")],
    });

    expect(trainingWeeksOf(stats).map((record) => record.required)).toEqual([3]);
  });

  it("should plan the active routine's day count when no goal is in force", () => {
    const stats = aStats({
      workouts: { ...aStats().workouts, weeks },
      activeRoutineDayCount: 5,
    });

    expect(trainingWeeksOf(stats).map((record) => record.required)).toEqual([5, 5]);
  });

  it("should plan 3 when there is no goal and no active routine", () => {
    const stats = aStats({ workouts: { ...aStats().workouts, weeks }, activeRoutineDayCount: 0 });

    expect(trainingWeeksOf(stats)).toEqual([
      { weekStart: "2026-11-02", achieved: 3, required: 3 },
      { weekStart: "2026-11-09", achieved: 3, required: 3 },
    ]);
  });

  it("should plan 3 when the routine count is unknown", () => {
    const stats = aStats({ workouts: { ...aStats().workouts, weeks: [week("2026-11-02", 1)] } });

    expect(trainingWeeksOf(stats).map((record) => record.required)).toEqual([3]);
  });
});

describe("trainingWeeksThroughOf", () => {
  // 2026-11-19 is a Thursday, so this week starts on Monday the 16th.
  const today = "2026-11-19";

  it("should add this week, with what it plans, when no session is finished in it yet", () => {
    const stats = aStats({
      workouts: { ...aStats().workouts, weeks: [week("2026-11-09", 4)] },
      trainingGoals: [goal(4, "2026-10-01", null)],
    });

    expect(trainingWeeksThroughOf(stats, today)).toEqual([
      { weekStart: "2026-11-09", achieved: 4, required: 4 },
      { weekStart: "2026-11-16", achieved: 0, required: 4 },
    ]);
  });

  it("should plan 3 for this week when there is no goal and no routine", () => {
    expect(trainingWeeksThroughOf(aStats(), today)).toEqual([
      { weekStart: "2026-11-16", achieved: 0, required: 3 },
    ]);
  });

  it("should leave this week alone when a session is already finished in it", () => {
    const stats = aStats({
      workouts: { ...aStats().workouts, weeks: [week("2026-11-16", 2)] },
      trainingGoals: [goal(4, "2026-10-01", null)],
    });

    expect(trainingWeeksThroughOf(stats, today)).toEqual([
      { weekStart: "2026-11-16", achieved: 2, required: 4 },
    ]);
  });
});

describe("weighInWeeksOf", () => {
  it("should make one record per Monday week with the weigh-ins of it and one required", () => {
    expect(weighInWeeksOf(["2026-11-04", "2026-11-08", "2026-11-09", "2026-11-04"])).toEqual([
      { weekStart: "2026-11-02", achieved: 2, required: 1 },
      { weekStart: "2026-11-09", achieved: 1, required: 1 },
    ]);
  });
});
