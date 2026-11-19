import { describe, expect, it } from "vitest";

import { weeklyStreak } from "../../../src/achievements/streaks";

import type { WeekRecord } from "../../../src/achievements/streaks";

const week = (weekStart: string, achieved: number, required = 3): WeekRecord => ({
  weekStart,
  achieved,
  required,
});

describe("weeklyStreak", () => {
  it("should run across a year boundary", () => {
    const weeks = [week("2025-12-22", 3), week("2025-12-29", 4), week("2026-01-05", 3)];

    expect(weeklyStreak(weeks, "2026-01-08")).toEqual({
      current: 3,
      longest: 3,
      thisWeek: "complete",
    });
  });

  it("should keep the streak while this week is still short, because it is at risk until Sunday ends", () => {
    const weeks = [week("2025-12-22", 3), week("2025-12-29", 3), week("2026-01-05", 1)];

    expect(weeklyStreak(weeks, "2026-01-11")).toEqual({
      current: 2,
      longest: 2,
      thisWeek: "at_risk",
    });
  });

  it("should reset on Monday when the week just ended fell short", () => {
    const weeks = [week("2025-12-22", 3), week("2025-12-29", 3), week("2026-01-05", 2)];

    expect(weeklyStreak(weeks, "2026-01-12")).toEqual({
      current: 0,
      longest: 2,
      thisWeek: "at_risk",
    });
  });

  it("should treat a week missing from the input as a week with nothing done", () => {
    const weeks = [week("2025-12-15", 3), week("2025-12-22", 3), week("2026-01-05", 3)];

    expect(weeklyStreak(weeks, "2026-01-12")).toEqual({
      current: 1,
      longest: 2,
      thisWeek: "at_risk",
    });
  });

  it("should count a week that goes beyond its required count", () => {
    expect(weeklyStreak([week("2026-01-05", 6, 2)], "2026-01-08").current).toBe(1);
  });

  it("should not count a week that falls one short", () => {
    expect(weeklyStreak([week("2026-01-05", 2, 3)], "2026-01-08").current).toBe(0);
  });

  it("should count a week of one weigh-in, where one is required", () => {
    expect(weeklyStreak([week("2026-01-05", 1, 1)], "2026-01-08")).toEqual({
      current: 1,
      longest: 1,
      thisWeek: "complete",
    });
  });

  it("should not count a week with nothing done even when its required count is zero", () => {
    expect(weeklyStreak([week("2026-01-05", 0, 0)], "2026-01-08").current).toBe(0);
  });

  it("should have no streak for no weeks", () => {
    expect(weeklyStreak([], "2026-01-08")).toEqual({
      current: 0,
      longest: 0,
      thisWeek: "at_risk",
    });
  });

  it("should keep the longest streak after a reset", () => {
    const weeks = [
      week("2025-11-24", 3),
      week("2025-12-01", 3),
      week("2025-12-08", 3),
      week("2025-12-15", 3),
      week("2025-12-29", 3),
    ];

    expect(weeklyStreak(weeks, "2026-01-02")).toMatchObject({ current: 1, longest: 4 });
  });
});
