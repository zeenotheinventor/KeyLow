import { describe, expect, it } from "vitest";

import { trendPoint } from "./trendPoints";
import { addCalendarDays } from "../../src/dates";
import { computeTrend } from "../../src/engine";
import { isTrendSettling } from "../../src/weight";

function trendOfDays(days: number) {
  return computeTrend(
    Array.from({ length: days }, (_, day) => ({
      localDate: addCalendarDays("2026-10-01", day),
      weightKg: 80,
    })),
  );
}

describe("isTrendSettling", () => {
  it("should be true after 6 accepted readings", () => {
    expect(isTrendSettling(trendOfDays(6))).toBe(true);
  });

  it("should be false after 7 accepted readings", () => {
    expect(isTrendSettling(trendOfDays(7))).toBe(false);
  });

  it("should be false for no points, which is the screen's empty state", () => {
    expect(isTrendSettling([])).toBe(false);
  });

  it("should read only the last point", () => {
    const points = [
      trendPoint({ date: "2026-10-16", nObs: 9 }),
      trendPoint({ date: "2026-10-17", nObs: 2 }),
    ];

    expect(isTrendSettling(points)).toBe(true);
  });

  it("should count accepted readings, so filled days do not settle the trend", () => {
    // 2 readings 10 days apart make 11 daily points but only 2 accepted readings.
    const points = computeTrend([
      { localDate: "2026-10-01", weightKg: 80 },
      { localDate: "2026-10-11", weightKg: 80 },
    ]);

    expect(points).toHaveLength(11);
    expect(isTrendSettling(points)).toBe(true);
  });
});
