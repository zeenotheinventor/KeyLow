import { describe, expect, it } from "vitest";

import { trendPoint } from "./trendPoints";
import { addCalendarDays } from "../../src/dates";
import { composeBodySplit } from "../../src/weight";

import type { BodySplitUnit, BodyTrendPoint } from "../../src/weight";

const EPSILON_DIGITS = 9;

function bodyPoint(
  overrides: Partial<BodyTrendPoint> & Pick<BodyTrendPoint, "date" | "trend">,
): BodyTrendPoint {
  return { segment: 0, raw: overrides.trend, interpolated: false, nObs: 10, ...overrides };
}

/** Weight trend points on 1 to 3 October 2026: 80, 80.5, 81. */
const goldenWeight = [
  trendPoint({ date: "2026-10-01", trendKg: 80 }),
  trendPoint({ date: "2026-10-02", trendKg: 80.5 }),
  trendPoint({ date: "2026-10-03", trendKg: 81 }),
];

/** Body fat trend on the same days: 20, 21, 22.5. */
const goldenBodyFat = [
  bodyPoint({ date: "2026-10-01", trend: 20 }),
  bodyPoint({ date: "2026-10-02", trend: 21 }),
  bodyPoint({ date: "2026-10-03", trend: 22.5 }),
];

function compose(
  input: Partial<{
    weight: ReturnType<typeof trendPoint>[];
    bodyFat: BodyTrendPoint[];
    leanMass: BodyTrendPoint[];
    unit: BodySplitUnit;
  }>,
) {
  return composeBodySplit({ weight: [], bodyFat: [], leanMass: [], unit: "kg", ...input });
}

describe("composeBodySplit · body fat drives", () => {
  const goldenKg = [
    { date: "2026-10-01", fat: 16, lean: 64, weight: 80 },
    { date: "2026-10-02", fat: 16.905, lean: 63.595, weight: 80.5 },
    { date: "2026-10-03", fat: 18.225, lean: 62.775, weight: 81 },
  ];

  it("should give fat and lean in kilograms from the golden table", () => {
    const split = compose({ weight: goldenWeight, bodyFat: goldenBodyFat, unit: "kg" });

    expect(split.driver).toBe("body_fat_pct");
    expect(split.points).toHaveLength(3);
    goldenKg.forEach((row, index) => {
      const point = split.points[index];
      expect(point?.date).toBe(row.date);
      expect(point?.segment).toBe(0);
      expect(point?.fat).toBeCloseTo(row.fat, EPSILON_DIGITS);
      expect(point?.lean).toBeCloseTo(row.lean, EPSILON_DIGITS);
    });
  });

  it("should add fat and lean up to the weight of the day in kilograms", () => {
    const split = compose({ weight: goldenWeight, bodyFat: goldenBodyFat, unit: "kg" });

    goldenKg.forEach((row, index) => {
      const point = split.points[index];
      expect((point?.fat ?? 0) + (point?.lean ?? 0)).toBeCloseTo(row.weight, EPSILON_DIGITS);
    });
  });

  it("should give fat and lean in per cent from the golden table", () => {
    const split = compose({ weight: goldenWeight, bodyFat: goldenBodyFat, unit: "pct" });

    const expected = [
      { fat: 20, lean: 80 },
      { fat: 21, lean: 79 },
      { fat: 22.5, lean: 77.5 },
    ];
    expected.forEach((row, index) => {
      const point = split.points[index];
      expect(point?.fat).toBeCloseTo(row.fat, EPSILON_DIGITS);
      expect(point?.lean).toBeCloseTo(row.lean, EPSILON_DIGITS);
      expect((point?.fat ?? 0) + (point?.lean ?? 0)).toBeCloseTo(100, EPSILON_DIGITS);
    });
  });

  it("should keep full float and round nothing", () => {
    const split = compose({
      weight: [trendPoint({ date: "2026-10-01", trendKg: 83.123456789 })],
      bodyFat: [bodyPoint({ date: "2026-10-01", trend: 22.987654321 })],
    });

    expect(split.points[0]?.fat).toBeCloseTo((83.123456789 * 22.987654321) / 100, 12);
  });

  it("should ignore the lean mass when body fat has points", () => {
    const leanMass = [
      bodyPoint({ date: "2026-10-01", trend: 61 }),
      bodyPoint({ date: "2026-10-02", trend: 60.6 }),
      bodyPoint({ date: "2026-10-03", trend: 59.8 }),
    ];

    const withLeanMass = compose({ weight: goldenWeight, bodyFat: goldenBodyFat, leanMass });
    const withoutLeanMass = compose({ weight: goldenWeight, bodyFat: goldenBodyFat });

    expect(withLeanMass).toEqual(withoutLeanMass);
    expect(withLeanMass.driver).toBe("body_fat_pct");
  });

  it("should stay on body fat when every body fat day is dropped, and draw nothing", () => {
    const split = compose({
      weight: [trendPoint({ date: "2026-10-10", trendKg: 80 })],
      bodyFat: [bodyPoint({ date: "2026-10-01", trend: 20 })],
      leanMass: [bodyPoint({ date: "2026-10-10", trend: 64 })],
    });

    expect(split.driver).toBe("body_fat_pct");
    expect(split.points).toEqual([]);
  });
});

describe("composeBodySplit · lean mass drives", () => {
  const weight = [trendPoint({ date: "2026-10-01", trendKg: 80 })];
  const leanMass = [bodyPoint({ date: "2026-10-01", trend: 64 })];

  it("should give fat as the weight less the lean mass in kilograms", () => {
    const split = compose({ weight, leanMass, unit: "kg" });

    expect(split.driver).toBe("lean_mass_kg");
    expect(split.points).toEqual([{ date: "2026-10-01", segment: 0, fat: 16, lean: 64 }]);
  });

  it("should give per cent of the weight", () => {
    const split = compose({ weight, leanMass, unit: "pct" });

    expect(split.points[0]?.fat).toBeCloseTo(20, EPSILON_DIGITS);
    expect(split.points[0]?.lean).toBeCloseTo(80, EPSILON_DIGITS);
  });

  it("should drop a day whose lean mass is at or above the weight and split the line there", () => {
    const split = compose({
      weight: [
        trendPoint({ date: "2026-10-01", trendKg: 80 }),
        trendPoint({ date: "2026-10-02", trendKg: 80 }),
        trendPoint({ date: "2026-10-03", trendKg: 80 }),
        trendPoint({ date: "2026-10-04", trendKg: 80 }),
      ],
      leanMass: [
        bodyPoint({ date: "2026-10-01", trend: 64 }),
        bodyPoint({ date: "2026-10-02", trend: 80 }),
        bodyPoint({ date: "2026-10-03", trend: 85 }),
        bodyPoint({ date: "2026-10-04", trend: 64 }),
      ],
    });

    expect(split.points.map(({ date, segment }) => ({ date, segment }))).toEqual([
      { date: "2026-10-01", segment: 0 },
      { date: "2026-10-04", segment: 1 },
    ]);
  });

  it.each([
    ["under 1 per cent", 198.5, false],
    ["over 75 per cent", 49, false],
    ["exactly 75 per cent", 50, true],
    ["exactly 1 per cent", 198, true],
  ])("should handle a derived body fat %s", (_label, leanKg, isKept) => {
    const split = compose({
      weight: [trendPoint({ date: "2026-10-01", trendKg: 200 })],
      leanMass: [bodyPoint({ date: "2026-10-01", trend: leanKg })],
    });

    expect(split.points).toHaveLength(isKept ? 1 : 0);
  });
});

describe("composeBodySplit · the weight for a day", () => {
  const lastWeighIn = "2026-10-10";
  const weight = [trendPoint({ date: lastWeighIn, trendKg: 80 })];

  it.each([
    [2, true],
    [30, true],
    [31, false],
  ])("should handle a body fat day %s days after the last weigh-in", (days, isKept) => {
    const date = addCalendarDays(lastWeighIn, days);
    const split = compose({ weight, bodyFat: [bodyPoint({ date, trend: 20 })] });

    expect(split.points).toHaveLength(isKept ? 1 : 0);
    if (isKept) {
      expect(split.points[0]?.fat).toBeCloseTo(16, EPSILON_DIGITS);
      expect(split.points[0]?.lean).toBeCloseTo(64, EPSILON_DIGITS);
    }
  });

  it("should hold the latest trend weight before the day, not an earlier one", () => {
    const split = compose({
      weight: [
        trendPoint({ date: "2026-10-01", trendKg: 70 }),
        trendPoint({ date: "2026-10-05", trendKg: 80 }),
      ],
      bodyFat: [bodyPoint({ date: "2026-10-07", trend: 10 })],
    });

    expect(split.points[0]?.fat).toBeCloseTo(8, EPSILON_DIGITS);
  });

  it("should drop a body fat day before the first weigh-in", () => {
    const split = compose({ weight, bodyFat: [bodyPoint({ date: "2026-10-09", trend: 20 })] });

    expect(split.points).toEqual([]);
  });

  it("should use the weight trend's own point for the date over an earlier one", () => {
    const split = compose({
      weight: [
        trendPoint({ date: "2026-10-01", trendKg: 70 }),
        trendPoint({ date: "2026-10-02", trendKg: 90 }),
      ],
      bodyFat: [bodyPoint({ date: "2026-10-02", trend: 10 })],
    });

    expect(split.points[0]?.fat).toBeCloseTo(9, EPSILON_DIGITS);
  });
});

describe("composeBodySplit · segments", () => {
  it("should start a new output segment where the driver's segment changes", () => {
    const split = compose({
      weight: goldenWeight,
      bodyFat: [
        bodyPoint({ date: "2026-10-01", trend: 20, segment: 0 }),
        bodyPoint({ date: "2026-10-02", trend: 21, segment: 1 }),
        bodyPoint({ date: "2026-10-03", trend: 22, segment: 1 }),
      ],
    });

    expect(split.points.map((point) => point.segment)).toEqual([0, 1, 1]);
  });

  it("should start a new output segment after a dropped driver day in the same driver segment", () => {
    const split = compose({
      weight: [
        trendPoint({ date: "2026-08-01", trendKg: 80 }),
        trendPoint({ date: "2026-09-20", trendKg: 82 }),
      ],
      bodyFat: [
        bodyPoint({ date: "2026-08-01", trend: 20 }),
        bodyPoint({ date: "2026-09-15", trend: 20 }),
        bodyPoint({ date: "2026-09-20", trend: 20 }),
      ],
    });

    expect(split.points.map(({ date, segment }) => ({ date, segment }))).toEqual([
      { date: "2026-08-01", segment: 0 },
      { date: "2026-09-20", segment: 1 },
    ]);
  });

  it("should count output segments from 0 even when the first driver days are dropped", () => {
    const split = compose({
      weight: [trendPoint({ date: "2026-10-02", trendKg: 80 })],
      bodyFat: [
        bodyPoint({ date: "2026-10-01", trend: 20 }),
        bodyPoint({ date: "2026-10-02", trend: 20 }),
      ],
    });

    expect(split.points.map(({ date, segment }) => ({ date, segment }))).toEqual([
      { date: "2026-10-02", segment: 0 },
    ]);
  });

  it("should split a line where a middle driver day is dropped", () => {
    const split = compose({
      weight: [
        trendPoint({ date: "2026-10-01", trendKg: 80 }),
        trendPoint({ date: "2026-10-02", trendKg: 80 }),
        trendPoint({ date: "2026-10-03", trendKg: 80 }),
      ],
      leanMass: [
        bodyPoint({ date: "2026-10-01", trend: 64 }),
        bodyPoint({ date: "2026-10-02", trend: 90 }),
        bodyPoint({ date: "2026-10-03", trend: 64 }),
      ],
    });

    expect(split.points.map((point) => point.segment)).toEqual([0, 1]);
  });
});

describe("composeBodySplit · settling", () => {
  it.each([
    [6, true],
    [7, false],
  ])("should be settling %s reading days in the driver's last segment: %s", (nObs, expected) => {
    const split = compose({
      weight: goldenWeight,
      bodyFat: [
        bodyPoint({ date: "2026-10-01", trend: 20, nObs: 1 }),
        bodyPoint({ date: "2026-10-02", trend: 21, nObs: 2 }),
        bodyPoint({ date: "2026-10-03", trend: 22, nObs }),
      ],
    });

    expect(split.settling).toBe(expected);
  });

  it("should read the driver's points, not the lean mass's", () => {
    const split = compose({
      weight: goldenWeight,
      bodyFat: [bodyPoint({ date: "2026-10-03", trend: 20, nObs: 3 })],
      leanMass: [bodyPoint({ date: "2026-10-03", trend: 64, nObs: 30 })],
    });

    expect(split.settling).toBe(true);
  });

  it("should still draw every point while settling", () => {
    const split = compose({
      weight: goldenWeight,
      bodyFat: goldenBodyFat.map((point) => ({ ...point, nObs: 2 })),
    });

    expect(split.settling).toBe(true);
    expect(split.points).toHaveLength(3);
  });
});

describe("composeBodySplit · edges", () => {
  it.each<BodySplitUnit>(["kg", "pct"])("should give no driver for empty inputs in %s", (unit) => {
    expect(composeBodySplit({ weight: [], bodyFat: [], leanMass: [], unit })).toEqual({
      driver: null,
      points: [],
      settling: false,
    });
  });

  it("should give no driver without body points even when there is a weight", () => {
    expect(compose({ weight: goldenWeight })).toEqual({
      driver: null,
      points: [],
      settling: false,
    });
  });

  it("should not mutate its inputs", () => {
    const weight = goldenWeight.map((point) => Object.freeze({ ...point }));
    const bodyFat = goldenBodyFat.map((point) => Object.freeze({ ...point }));
    const leanMass = goldenBodyFat.map((point) => Object.freeze({ ...point }));
    const before = JSON.stringify({ weight, bodyFat, leanMass });

    composeBodySplit({
      weight: Object.freeze(weight),
      bodyFat: Object.freeze(bodyFat),
      leanMass: Object.freeze(leanMass),
      unit: "kg",
    });

    expect(JSON.stringify({ weight, bodyFat, leanMass })).toBe(before);
  });

  it("should give the same answer twice and keep date order", () => {
    const input = {
      weight: goldenWeight,
      bodyFat: goldenBodyFat,
      leanMass: [],
      unit: "kg",
    } as const;
    const first = composeBodySplit(input);

    expect(composeBodySplit(input)).toEqual(first);
    expect(first.points.map((point) => point.date)).toEqual(
      [...first.points.map((p) => p.date)].sort(),
    );
  });
});
