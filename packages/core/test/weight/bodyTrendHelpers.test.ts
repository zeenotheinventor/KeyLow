import { describe, expect, it } from "vitest";

import { addCalendarDays } from "../../src/dates";
import {
  bodyChangeOverRange,
  bodyPointsInRange,
  computeBodyTrend,
  isBodyTrendSettling,
} from "../../src/weight";

import type { BodyTrendPoint } from "../../src/weight";

const TODAY = "2026-10-23";

function point(overrides: Partial<BodyTrendPoint> & Pick<BodyTrendPoint, "date">): BodyTrendPoint {
  return { segment: 0, trend: 20, raw: 20, interpolated: false, nObs: 1, ...overrides };
}

/** One daily point per day ending on `today`, the trend falling by `fallPerDay` a day from 30. */
function fallingPoints(days: number, fallPerDay: number): BodyTrendPoint[] {
  return Array.from({ length: days }, (_, index) =>
    point({ date: addCalendarDays(TODAY, index - (days - 1)), trend: 30 - fallPerDay * index }),
  );
}

describe("isBodyTrendSettling", () => {
  it.each([
    [6, true],
    [7, false],
  ])("should be %s readings gives %s", (nObs, expected) => {
    expect(isBodyTrendSettling([point({ date: TODAY, nObs })])).toBe(expected);
  });

  it("should be false for no points", () => {
    expect(isBodyTrendSettling([])).toBe(false);
  });

  it("should read the last point only", () => {
    expect(
      isBodyTrendSettling([
        point({ date: "2026-10-22", nObs: 2 }),
        point({ date: TODAY, nObs: 9 }),
      ]),
    ).toBe(false);
  });

  it("should call a series of 6 daily readings settling and 7 settled", () => {
    const sixDays = Array.from({ length: 6 }, (_, index) => ({
      localDate: addCalendarDays("2026-10-01", index),
      value: 20,
    }));

    expect(isBodyTrendSettling(computeBodyTrend(sixDays, "body_fat_pct"))).toBe(true);
    expect(
      isBodyTrendSettling(
        computeBodyTrend([...sixDays, { localDate: "2026-10-07", value: 20 }], "body_fat_pct"),
      ),
    ).toBe(false);
  });
});

describe("bodyPointsInRange", () => {
  const points = fallingPoints(40, 0.05);

  it("should keep the days of the 7-day window, today and the six before", () => {
    expect(bodyPointsInRange(points, 7, TODAY).map((p) => p.date)).toStrictEqual(
      Array.from({ length: 7 }, (_, index) => addCalendarDays(TODAY, index - 6)),
    );
  });

  it("should keep the points untouched and in order", () => {
    const inRange = bodyPointsInRange(points, 30, TODAY);

    expect(inRange).toHaveLength(30);
    expect(inRange[0]).toBe(points[10]);
  });

  it("should drop a point dated after today", () => {
    const withFuture = [...points, point({ date: addCalendarDays(TODAY, 1) })];

    expect(bodyPointsInRange(withFuture, 7, TODAY).at(-1)?.date).toBe(TODAY);
  });

  it("should return nothing for no points", () => {
    expect(bodyPointsInRange([], 30, TODAY)).toStrictEqual([]);
  });
});

describe("bodyChangeOverRange", () => {
  it("should give about -1.5 over a 30-day range for a body fat falling 0.05 a day for 60 days", () => {
    const readings = Array.from({ length: 60 }, (_, index) => ({
      localDate: addCalendarDays("2026-08-25", index),
      value: 30 - 0.05 * index,
    }));
    const points = computeBodyTrend(readings, "body_fat_pct");
    const today = points.at(-1)?.date ?? "";
    const inWindow = bodyPointsInRange(points, 30, today);
    const expected = (inWindow.at(-1)?.trend ?? Number.NaN) - (inWindow[0]?.trend ?? Number.NaN);

    const change = bodyChangeOverRange(points, 30, today);

    expect(change).not.toBeNull();
    expect(Math.abs((change ?? Number.NaN) - expected)).toBeLessThan(0.02);
    expect(Math.abs((change ?? Number.NaN) + 1.45)).toBeLessThan(0.1);
  });

  it("should be last minus first inside the window, unrounded, and negative for a fall", () => {
    const points = fallingPoints(40, 0.05);

    // Window of 30 days: the first point is 29 days before the last.
    expect(bodyChangeOverRange(points, 30, TODAY)).toBe(
      (points.at(-1)?.trend ?? 0) - (points.at(-30)?.trend ?? 0),
    );
    expect(bodyChangeOverRange(points, 30, TODAY)).toBeLessThan(0);
  });

  it("should be positive for a rise", () => {
    expect(bodyChangeOverRange(fallingPoints(20, -0.1), 30, TODAY)).toBeGreaterThan(0);
  });

  it("should be null for an empty list", () => {
    expect(bodyChangeOverRange([], 30, TODAY)).toBeNull();
  });

  it("should be null for a single point", () => {
    expect(bodyChangeOverRange(fallingPoints(1, 0.05), 30, TODAY)).toBeNull();
  });

  it("should be null when the points are under 6 days apart", () => {
    expect(bodyChangeOverRange(fallingPoints(6, 0.05), 30, TODAY)).toBeNull();
  });

  it("should give a change when the points are exactly 6 days apart", () => {
    expect(bodyChangeOverRange(fallingPoints(7, 0.05), 30, TODAY)).not.toBeNull();
  });

  it("should give a number for a 1-week window whose points are 6 days apart", () => {
    const points = fallingPoints(40, 0.05);

    expect(bodyChangeOverRange(points, 7, TODAY)).toBe(
      (points.at(-1)?.trend ?? 0) - (points.at(-7)?.trend ?? 0),
    );
  });

  it("should be null when a new segment starts inside the window and is under 6 days old", () => {
    const points = fallingPoints(40, 0.05).map((p, index) =>
      index >= 36 ? { ...p, segment: 1 } : p,
    );

    expect(bodyChangeOverRange(points, 30, TODAY)).toBeNull();
  });

  it("should compare within the new segment once it is 6 days old", () => {
    const points = fallingPoints(40, 0.05).map((p, index) =>
      index >= 30 ? { ...p, segment: 1 } : p,
    );

    expect(bodyChangeOverRange(points, 30, TODAY)).toBe(
      (points.at(-1)?.trend ?? 0) - (points.at(30)?.trend ?? 0),
    );
  });

  it("should be null when the last point is older than the window", () => {
    const stale = fallingPoints(40, 0.05);

    expect(bodyChangeOverRange(stale, 30, addCalendarDays(TODAY, 60))).toBeNull();
  });
});
