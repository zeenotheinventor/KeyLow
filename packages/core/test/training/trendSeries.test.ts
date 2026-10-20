import { describe, expect, it } from "vitest";

import { trendSeries } from "../../src/training";

import type { TrendEntry } from "../../src/training";

const trained = (weekStart: string, loadKg: number | null, reps: number): TrendEntry => ({
  weekStart,
  value: { loadKg, reps },
  change: { kind: "first" },
});
const skipped = (weekStart: string): TrendEntry => ({ weekStart, value: null, change: null });

describe("trendSeries", () => {
  it("should plot the load of each week in the unit, with a skipped week as a gap", () => {
    const series = trendSeries(
      [trained("2026-10-05", 60, 8), skipped("2026-10-12"), trained("2026-10-19", 62.5, 6)],
      "kg",
    );

    expect(series).toEqual({
      unit: "kg",
      points: [
        { week: "2026-10-05", value: 60 },
        { week: "2026-10-12", value: null },
        { week: "2026-10-19", value: 62.5 },
      ],
    });
  });

  it("should plot pounds from the stored kilograms, as they are shown", () => {
    const series = trendSeries([trained("2026-10-19", 100, 5)], "lb");

    expect(series).toEqual({ unit: "lb", points: [{ week: "2026-10-19", value: 220.5 }] });
  });

  it("should plot the reps when no week has a load", () => {
    const series = trendSeries(
      [trained("2026-10-12", null, 10), skipped("2026-10-19"), trained("2026-10-26", null, 12)],
      "lb",
    );

    expect(series).toEqual({
      unit: "reps",
      points: [
        { week: "2026-10-12", value: 10 },
        { week: "2026-10-19", value: null },
        { week: "2026-10-26", value: 12 },
      ],
    });
  });

  it("should count a week with no load as 0 when another week has a load, as the change does", () => {
    const series = trendSeries(
      [trained("2026-10-12", null, 10), trained("2026-10-19", 10, 8)],
      "kg",
    );

    expect(series.unit).toBe("kg");
    expect(series.points.map(({ value }) => value)).toEqual([0, 10]);
  });
});
