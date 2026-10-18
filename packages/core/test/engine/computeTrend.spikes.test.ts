import { describe, expect, it } from "vitest";

import { addCalendarDays } from "../../src/dates";
import { computeTrend } from "../../src/engine";

import type { TrendInput } from "../../src/engine";

/** Readings on consecutive dates from 2026-10-10, with null for a day nobody weighed. */
function week(weights: readonly (number | null)[]): TrendInput[] {
  return weights.flatMap((weightKg, index) =>
    weightKg === null ? [] : [{ localDate: addCalendarDays("2026-10-10", index), weightKg }],
  );
}

const FIVE_STEADY = [80, 80, 80, 80, 80];

describe("computeTrend winsorising", () => {
  it("should clamp 84.0 after five readings at 80.0 to 82.0", () => {
    const point = computeTrend(week([...FIVE_STEADY, 84]))[5];

    expect(point).toMatchObject({
      rawKg: 84,
      usedKg: 82,
      winsorised: true,
      rejected: false,
      interpolated: false,
      nObs: 6,
    });
    expect(point?.trendKg).toBeCloseTo(80.427, 3);
  });

  it("should clamp 76.0 after five readings at 80.0 to 78.0", () => {
    const point = computeTrend(week([...FIVE_STEADY, 76]))[5];

    expect(point).toMatchObject({ rawKg: 76, usedKg: 78, winsorised: true, rejected: false });
    expect(point?.trendKg).toBeCloseTo(79.573, 3);
  });

  it("should not clamp a reading inside 2.5% of the trend", () => {
    const point = computeTrend(week([...FIVE_STEADY, 81.5]))[5];

    expect(point).toMatchObject({ usedKg: 81.5, winsorised: false, rejected: false });
  });

  it("should use 84.0 and 76.0 as they are after only four readings", () => {
    for (const spike of [84, 76]) {
      const point = computeTrend(week([80, 80, 80, 80, spike]))[4];

      expect(point).toMatchObject({
        rawKg: spike,
        usedKg: spike,
        winsorised: false,
        rejected: false,
      });
    }
  });

  it("should apply the rule from the sixth reading, not the fifth", () => {
    const points = computeTrend(week([80, 80, 80, 80, 84, 90]));

    expect(points[4]).toMatchObject({ usedKg: 84, winsorised: false });
    expect(points[5]).toMatchObject({ rawKg: 90, winsorised: true, rejected: false });
    // The trend after the unclamped 84 is 80.977, so 90 is clamped to 83.001 and not to 82.
    expect(points[5]?.usedKg).toBeCloseTo(83.001, 3);
  });

  it("should count only readings in the same segment", () => {
    const points = computeTrend([
      ...week(FIVE_STEADY),
      { localDate: "2026-12-01", weightKg: 90 },
      { localDate: "2026-12-02", weightKg: 90 },
    ]);

    expect(points.filter((point) => point.segment === 1)).toMatchObject([
      { usedKg: 90, winsorised: false },
      { usedKg: 90, winsorised: false },
    ]);
  });
});

describe("computeTrend rejecting", () => {
  it("should reject 95.0 followed by 80.3 and fill its day like a missing one", () => {
    const point = computeTrend(week([...FIVE_STEADY, 95, 80.3]))[5];

    expect(point).toMatchObject({
      rawKg: 95,
      rejected: true,
      interpolated: true,
      winsorised: false,
      nObs: 5,
    });
    expect(point?.usedKg).toBeCloseTo(80.15, 12);
    expect(point?.trendKg).toBeCloseTo(80.032, 3);
  });

  it("should give a rejected day the trend of the same series with that day missing", () => {
    const rejected = computeTrend(week([...FIVE_STEADY, 95, 80.3]));
    const missing = computeTrend(week([...FIVE_STEADY, null, 80.3]));

    expect(rejected.map((point) => point.trendKg)).toStrictEqual(
      missing.map((point) => point.trendKg),
    );
    expect(rejected.map((point) => point.usedKg)).toStrictEqual(
      missing.map((point) => point.usedKg),
    );
    expect(missing[5]).toMatchObject({ rawKg: null, rejected: false, interpolated: true });
  });

  it("should carry on from the rejected day without counting it", () => {
    const point = computeTrend(week([...FIVE_STEADY, 95, 80.3]))[6];

    expect(point).toMatchObject({ rawKg: 80.3, usedKg: 80.3, nObs: 6, rejected: false });
    expect(point?.trendKg).toBeCloseTo(80.083, 3);
  });

  it("should not reject 95.0 followed by 94.8, and winsorise it to 82.0", () => {
    const points = computeTrend(week([...FIVE_STEADY, 95, 94.8]));

    expect(points[5]).toMatchObject({
      rawKg: 95,
      usedKg: 82,
      winsorised: true,
      rejected: false,
      interpolated: false,
      nObs: 6,
    });
    expect(points[6]).toMatchObject({ rejected: false, nObs: 7 });
  });

  it("should not reject a single 95.0 as the very last reading", () => {
    const point = computeTrend(week([...FIVE_STEADY, 95]))[5];

    expect(point).toMatchObject({ usedKg: 82, winsorised: true, rejected: false, nObs: 6 });
  });

  it("should not reject the last reading of a segment when the next reading is in another segment", () => {
    const points = computeTrend([
      ...week([...FIVE_STEADY, 95]),
      { localDate: "2026-12-01", weightKg: 80 },
    ]);

    expect(points[5]).toMatchObject({ segment: 0, rejected: false, winsorised: true });
  });

  it("should use 95.0 followed by 80.3 as it is after only four readings", () => {
    const points = computeTrend(week([80, 80, 80, 80, 95, 80.3]));

    expect(points[4]).toMatchObject({
      usedKg: 95,
      rejected: false,
      winsorised: false,
      interpolated: false,
      nObs: 5,
    });
  });

  it("should fill two rejected days in a row from the accepted readings either side", () => {
    // 95 disagrees with the 60 after it, and 60 disagrees with the 80.3 after it. Both are far from 80.
    const points = computeTrend(week([...FIVE_STEADY, 95, 60, 80.3]));

    expect(points.map((point) => point.rejected)).toStrictEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      true,
      false,
    ]);
    expect(points[5]?.usedKg).toBeCloseTo(80.1, 12);
    expect(points[6]?.usedKg).toBeCloseTo(80.2, 12);
    expect(points[5]).toMatchObject({ rawKg: 95, interpolated: true, nObs: 5 });
    expect(points[6]).toMatchObject({ rawKg: 60, interpolated: true, nObs: 5 });
    expect(points[7]).toMatchObject({ nObs: 6 });
  });

  it("should fill a rejected day between accepted readings that have a missing day beside it", () => {
    const points = computeTrend(week([...FIVE_STEADY, null, 95, 80.3]));

    expect(points.map((point) => point.interpolated)).toStrictEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      true,
      false,
    ]);
    expect(points[5]).toMatchObject({ rawKg: null, rejected: false });
    expect(points[6]).toMatchObject({ rawKg: 95, rejected: true });
    expect(points[6]?.usedKg).toBeCloseTo(80.2, 12);
  });
});
