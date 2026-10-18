import { describe, expect, it } from "vitest";

import { addCalendarDays } from "../../src/dates";
import { computeTrend, DEFAULT_ENGINE_PARAMS } from "../../src/engine";

import type { TrendInput } from "../../src/engine";

/** Readings on consecutive dates from `start`, one per weight. */
function consecutive(start: string, weights: readonly number[]): TrendInput[] {
  return weights.map((weightKg, index) => ({ localDate: addCalendarDays(start, index), weightKg }));
}

describe("computeTrend golden table", () => {
  // alpha 0.10, raw 80.0, 81.0, 79.5, a missing day, 80.2 on consecutive dates.
  const weighIns: TrendInput[] = [
    { localDate: "2026-10-15", weightKg: 80 },
    { localDate: "2026-10-16", weightKg: 81 },
    { localDate: "2026-10-17", weightKg: 79.5 },
    { localDate: "2026-10-19", weightKg: 80.2 },
  ];
  const points = computeTrend(weighIns);

  it("should give a point for every calendar day, in date order", () => {
    expect(points.map((point) => point.date)).toStrictEqual([
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
    ]);
  });

  it("should give the trend 80.000, 80.526, 80.148, 80.061, 80.095", () => {
    const expected = [80.0, 80.526, 80.148, 80.061, 80.095];

    points.forEach((point, index) => {
      expect(point.trendKg).toBeCloseTo(expected[index] ?? Number.NaN, 3);
    });
  });

  it("should start the trend on the first reading exactly", () => {
    expect(points[0]?.trendKg).toBe(80);
  });

  it("should interpolate the missing day at 79.85 and flag only that day", () => {
    expect(points.map((point) => point.interpolated)).toStrictEqual([
      false,
      false,
      false,
      true,
      false,
    ]);
    expect(points[3]?.usedKg).toBeCloseTo(79.85, 12);
    expect(points[3]?.rawKg).toBeNull();
  });

  it("should show the readings as raw and as used on the days that had one", () => {
    expect(points.map((point) => point.rawKg)).toStrictEqual([80, 81, 79.5, null, 80.2]);
    expect(points.map((point) => point.usedKg).filter((_, index) => index !== 3)).toStrictEqual([
      80, 81, 79.5, 80.2,
    ]);
  });

  it("should count the accepted reading days so far", () => {
    expect(points.map((point) => point.nObs)).toStrictEqual([1, 2, 3, 3, 4]);
  });

  it("should flag nothing as rejected or winsorised and keep one segment", () => {
    expect(points.every((point) => !point.rejected && !point.winsorised)).toBe(true);
    expect(points.every((point) => point.segment === 0)).toBe(true);
  });
});

describe("computeTrend segments", () => {
  it("should keep readings 30 days apart in one segment with 29 interpolated days", () => {
    const points = computeTrend([
      { localDate: "2026-09-01", weightKg: 80 },
      { localDate: "2026-10-01", weightKg: 79 },
    ]);

    expect(points).toHaveLength(31);
    expect(points.filter((point) => point.interpolated)).toHaveLength(29);
    expect(new Set(points.map((point) => point.segment))).toStrictEqual(new Set([0]));
  });

  it("should start segment 1 for readings 31 days apart, restarting the trend and the count", () => {
    const points = computeTrend([
      { localDate: "2026-09-01", weightKg: 80 },
      { localDate: "2026-10-02", weightKg: 82.4 },
    ]);

    expect(points).toHaveLength(2);
    expect(points[1]?.segment).toBe(1);
    expect(points[1]?.trendKg).toBe(82.4);
    expect(points[1]?.nObs).toBe(1);
    expect(points[1]?.interpolated).toBe(false);
  });

  it("should smooth a second segment as if the first were not there", () => {
    const second = [82, 83, 81.5];
    const alone = computeTrend(consecutive("2026-11-01", second));
    const both = computeTrend([
      ...consecutive("2026-09-01", [70, 71, 69]),
      ...consecutive("2026-11-01", second),
    ]);

    expect(both.filter((point) => point.segment === 1).map((point) => point.trendKg)).toStrictEqual(
      alone.map((point) => point.trendKg),
    );
  });

  it("should number the segments from 0 in date order", () => {
    const points = computeTrend([
      { localDate: "2026-06-01", weightKg: 80 },
      { localDate: "2026-01-01", weightKg: 80 },
      { localDate: "2026-03-01", weightKg: 80 },
    ]);

    expect(points.map((point) => [point.date, point.segment])).toStrictEqual([
      ["2026-01-01", 0],
      ["2026-03-01", 1],
      ["2026-06-01", 2],
    ]);
  });
});

describe("computeTrend input", () => {
  it("should return nothing for no readings", () => {
    expect(computeTrend([])).toStrictEqual([]);
  });

  it("should return one point for one reading", () => {
    expect(computeTrend([{ localDate: "2026-10-15", weightKg: 80.4 }])).toStrictEqual([
      {
        date: "2026-10-15",
        segment: 0,
        trendKg: 80.4,
        rawKg: 80.4,
        usedKg: 80.4,
        rejected: false,
        winsorised: false,
        interpolated: false,
        nObs: 1,
      },
    ]);
  });

  it("should take the median of two readings on one date", () => {
    const points = computeTrend([
      { localDate: "2026-10-15", weightKg: 80 },
      { localDate: "2026-10-15", weightKg: 81 },
    ]);

    expect(points).toHaveLength(1);
    expect(points[0]?.rawKg).toBe(80.5);
    expect(points[0]?.trendKg).toBe(80.5);
  });

  it("should skip a reading at 19.9 kg and one at 400.1 kg as if it had not been taken", () => {
    const points = computeTrend([
      { localDate: "2026-10-15", weightKg: 80 },
      { localDate: "2026-10-16", weightKg: 19.9 },
      { localDate: "2026-10-17", weightKg: 82 },
      { localDate: "2026-10-18", weightKg: 400.1 },
    ]);

    expect(points.map((point) => point.date)).toStrictEqual([
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
    ]);
    expect(points[1]).toMatchObject({ rawKg: null, interpolated: true, usedKg: 81 });
  });

  it("should return nothing when every reading is out of bounds", () => {
    expect(computeTrend([{ localDate: "2026-10-15", weightKg: 19.9 }])).toStrictEqual([]);
  });

  it("should keep readings at exactly 20 kg and 400 kg", () => {
    const points = computeTrend([
      { localDate: "2026-10-15", weightKg: 20 },
      { localDate: "2026-10-16", weightKg: 400 },
    ]);

    expect(points.map((point) => point.rawKg)).toStrictEqual([20, 400]);
  });

  it("should give the same points for an unsorted input as for a sorted one", () => {
    const sorted = consecutive("2026-10-10", [80, 81, 79.5, 80.2, 80.9, 79.9]);
    const unsorted = [sorted[3], sorted[0], sorted[5], sorted[2], sorted[4], sorted[1]].filter(
      (reading) => reading !== undefined,
    );

    expect(computeTrend(unsorted)).toStrictEqual(computeTrend(sorted));
  });

  it("should throw a RangeError for a malformed date, before any maths", () => {
    expect(() => computeTrend([{ localDate: "15/10/2026", weightKg: 80 }])).toThrow(RangeError);
  });

  it("should throw a RangeError for a weight that is not finite", () => {
    expect(() => computeTrend([{ localDate: "2026-10-15", weightKg: Number.NaN }])).toThrow(
      RangeError,
    );
  });

  it("should not put the weight in the message of a thrown error", () => {
    expect(() => computeTrend([{ localDate: "bad-date", weightKg: 81.7 }])).toThrow(/^(?!.*81).*$/);
  });

  it("should return 5,000 points for 5,000 consecutive days", () => {
    const weights = Array.from({ length: 5000 }, (_, day) => 80 + Math.sin(day / 10));

    const points = computeTrend(consecutive("2010-01-01", weights));

    expect(points).toHaveLength(5000);
    expect(points[4999]?.date).toBe(addCalendarDays("2010-01-01", 4999));
  });

  it("should not change the array it is given", () => {
    const weighIns = consecutive("2026-10-10", [81, 80, 79.5]).reverse();
    const before = structuredClone(weighIns);

    computeTrend(weighIns);

    expect(weighIns).toStrictEqual(before);
  });

  it("should give identical output when called twice", () => {
    const weighIns = consecutive("2026-10-10", [81, 80, 79.5]);

    expect(computeTrend(weighIns)).toStrictEqual(computeTrend(weighIns));
  });

  it("should smooth with the alpha it is given", () => {
    const weighIns = consecutive("2026-10-10", [80, 90]);

    const quick = computeTrend(weighIns, { ...DEFAULT_ENGINE_PARAMS.trend, alpha: 0.5 });

    // S0 = 40, S1 = 0.5 * 40 + 45 = 65, over 1 - 0.25 = 0.75.
    expect(quick[1]?.trendKg).toBeCloseTo(65 / 0.75, 12);
  });

  it("should split on the gap it is given", () => {
    const weighIns = [
      { localDate: "2026-10-10", weightKg: 80 },
      { localDate: "2026-10-14", weightKg: 80 },
    ];

    const points = computeTrend(weighIns, { ...DEFAULT_ENGINE_PARAMS.trend, maxGapDays: 3 });

    expect(points.map((point) => point.segment)).toStrictEqual([0, 1]);
  });
});
