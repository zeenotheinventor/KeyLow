import { describe, expect, it } from "vitest";

import { trendKgAt, trendPoint } from "./trendPoints";
import { addCalendarDays } from "../../src/dates";
import { computeTrend } from "../../src/engine";
import { weeklyRateKg } from "../../src/weight";

import type { TrendInput } from "../../src/engine";

const START = "2026-01-01";

/** One reading a day for `days` days, the first on the `firstDay`th day after `START`. */
function dailyReadings(
  days: number,
  weightOnDay: (day: number) => number,
  firstDay = 0,
): TrendInput[] {
  return Array.from({ length: days }, (_, day) => ({
    localDate: addCalendarDays(START, firstDay + day),
    weightKg: weightOnDay(day),
  }));
}

describe("weeklyRateKg", () => {
  it("should be the last trend minus the trend 7 days earlier, unrounded", () => {
    const points = [
      trendPoint({ date: "2026-10-10", trendKg: 81.25 }),
      trendPoint({ date: "2026-10-11", trendKg: 81.1 }),
      trendPoint({ date: "2026-10-12", trendKg: 81 }),
      trendPoint({ date: "2026-10-13", trendKg: 80.9 }),
      trendPoint({ date: "2026-10-14", trendKg: 80.8 }),
      trendPoint({ date: "2026-10-15", trendKg: 80.7 }),
      trendPoint({ date: "2026-10-16", trendKg: 80.6 }),
      trendPoint({ date: "2026-10-17", trendKg: 80.9 }),
    ];

    expect(weeklyRateKg(points)).toBe(80.9 - 81.25);
  });

  it("should be negative for a loss and positive for a gain", () => {
    const loss = [
      trendPoint({ date: "2026-10-10", trendKg: 82 }),
      trendPoint({ date: "2026-10-17", trendKg: 81 }),
    ];
    const gain = [
      trendPoint({ date: "2026-10-10", trendKg: 81 }),
      trendPoint({ date: "2026-10-17", trendKg: 82 }),
    ];

    expect(weeklyRateKg(loss)).toBe(-1);
    expect(weeklyRateKg(gain)).toBe(1);
  });

  it("should read about -0.35 kg for a series falling 0.05 kg a day for 60 days", () => {
    const points = computeTrend(dailyReadings(60, (day) => 100 - 0.05 * day));
    const rate = weeklyRateKg(points);

    expect(rate).not.toBeNull();
    expect(rate).toBe(trendKgAt(points, points.length - 1) - trendKgAt(points, points.length - 8));
    expect(rate).toBeGreaterThan(-0.37);
    expect(rate).toBeLessThan(-0.33);
  });

  it("should be null when the last point has no point 7 days earlier", () => {
    const points = computeTrend(dailyReadings(7, () => 80));

    expect(points).toHaveLength(7);
    expect(weeklyRateKg(points)).toBeNull();
  });

  it("should have a rate from the eighth day, which is the first with a point 7 days earlier", () => {
    const points = computeTrend(dailyReadings(8, () => 80));

    expect(weeklyRateKg(points)).toBe(0);
  });

  it("should be null when a new segment began inside the last 7 days", () => {
    const points = computeTrend([
      ...dailyReadings(10, () => 80),
      ...dailyReadings(4, () => 80, 60),
    ]);

    expect(points[points.length - 1]?.segment).toBe(1);
    expect(weeklyRateKg(points)).toBeNull();
  });

  it("should be null when the point 7 days earlier belongs to another segment", () => {
    const points = [
      trendPoint({ date: "2026-10-10", segment: 0, trendKg: 82 }),
      trendPoint({ date: "2026-10-17", segment: 1, trendKg: 81 }),
    ];

    expect(weeklyRateKg(points)).toBeNull();
  });

  it("should be null when the day exactly 7 days earlier has no point", () => {
    const points = [
      trendPoint({ date: "2026-10-09", trendKg: 82 }),
      trendPoint({ date: "2026-10-17", trendKg: 81 }),
    ];

    expect(weeklyRateKg(points)).toBeNull();
  });

  it("should be null for no points", () => {
    expect(weeklyRateKg([])).toBeNull();
  });

  it("should count 7 calendar days across a month end and a leap day", () => {
    const points = [
      trendPoint({ date: "2028-02-26", trendKg: 80 }),
      trendPoint({ date: "2028-03-04", trendKg: 79 }),
    ];

    expect(weeklyRateKg(points)).toBe(-1);
  });
});
