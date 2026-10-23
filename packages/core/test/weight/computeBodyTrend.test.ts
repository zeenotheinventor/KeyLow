import { describe, expect, it } from "vitest";

import { addCalendarDays } from "../../src/dates";
import { computeTrend } from "../../src/engine";
import { computeBodyTrend } from "../../src/weight";

import type { BodyMeasurementKind, BodyReading, BodyTrendPoint } from "../../src/weight";

/** Readings on consecutive dates from `start`, one per value. */
function consecutive(start: string, values: readonly number[]): BodyReading[] {
  return values.map((value, index) => ({ localDate: addCalendarDays(start, index), value }));
}

/** The bias-corrected EWMA at alpha 0.10 written the plain way, apart from the engine's step form. */
function expectedTrend(values: readonly number[]): number[] {
  const alpha = 0.1;
  let smoothed = 0;
  return values.map((value, day) => {
    smoothed = (1 - alpha) * smoothed + alpha * value;
    return smoothed / (1 - (1 - alpha) ** (day + 1));
  });
}

function trendAt(points: readonly BodyTrendPoint[], index: number): number {
  const point = points[index];
  if (point === undefined) {
    throw new RangeError(`No point at index ${index}.`);
  }
  return point.trend;
}

describe("computeBodyTrend against the weight golden table", () => {
  // The weight golden of computeTrend (80.0, 81.0, 79.5, a missing day, 80.2) times 0.25.
  const readings: BodyReading[] = [
    { localDate: "2026-10-15", value: 20 },
    { localDate: "2026-10-16", value: 20.25 },
    { localDate: "2026-10-17", value: 19.875 },
    { localDate: "2026-10-19", value: 20.05 },
  ];
  const points = computeBodyTrend(readings, "body_fat_pct");

  it("should give a point for every calendar day, in date order", () => {
    expect(points.map((point) => point.date)).toStrictEqual([
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
    ]);
  });

  it("should give the trend 20.000, 20.1315, 20.037, 20.01525, 20.02375", () => {
    const golden = [20.0, 20.1315, 20.037, 20.01525, 20.02375];

    points.forEach((point, index) => {
      expect(Math.abs(point.trend - (golden[index] ?? Number.NaN))).toBeLessThan(0.001);
    });
  });

  it("should flag only the missing day as interpolated, with no raw reading", () => {
    expect(points.map((point) => point.interpolated)).toStrictEqual([
      false,
      false,
      false,
      true,
      false,
    ]);
    expect(points.map((point) => point.raw)).toStrictEqual([20, 20.25, 19.875, null, 20.05]);
  });

  it("should count the accepted reading days, and carry the interpolated day on the count so far", () => {
    expect(points.map((point) => point.nObs)).toStrictEqual([1, 2, 3, 3, 4]);
  });

  it("should agree with computeTrend on the same numbers scaled up by 4, to 1e-9", () => {
    const weight = computeTrend(
      readings.map(({ localDate, value }) => ({ localDate, weightKg: value * 4 })),
    );

    expect(points).toHaveLength(weight.length);
    weight.forEach((weightPoint, index) => {
      expect(Math.abs(trendAt(points, index) * 4 - weightPoint.trendKg)).toBeLessThan(1e-9);
    });
  });

  it("should give every point segment 0", () => {
    expect(points.every((point) => point.segment === 0)).toBe(true);
  });
});

describe("computeBodyTrend", () => {
  it("should return no points for no readings", () => {
    expect(computeBodyTrend([], "lean_mass_kg")).toStrictEqual([]);
  });

  it("should start the trend on the first reading exactly", () => {
    expect(computeBodyTrend(consecutive("2026-10-15", [22.37]), "body_fat_pct")[0]?.trend).toBe(
      22.37,
    );
  });

  it("should take the median of several readings on one date, in any order", () => {
    const points = computeBodyTrend(
      [
        { localDate: "2026-10-15", value: 24 },
        { localDate: "2026-10-15", value: 20 },
        { localDate: "2026-10-15", value: 21 },
      ],
      "body_fat_pct",
    );

    expect(points).toHaveLength(1);
    expect(points[0]?.raw).toBe(21);
  });

  it("should give the same points whatever the order of the readings", () => {
    const readings = consecutive("2026-10-15", [20, 21, 19.5, 20.5]);

    expect(computeBodyTrend([...readings].reverse(), "body_fat_pct")).toStrictEqual(
      computeBodyTrend(readings, "body_fat_pct"),
    );
  });

  it("should not change the readings it is given", () => {
    const readings = consecutive("2026-10-15", [20, 21, 19.5]);
    const copy = structuredClone(readings);

    computeBodyTrend(readings, "body_fat_pct");

    expect(readings).toStrictEqual(copy);
  });

  describe("segments", () => {
    const gapOf = (days: number): BodyTrendPoint[] =>
      computeBodyTrend(
        [
          { localDate: "2026-01-01", value: 20 },
          { localDate: addCalendarDays("2026-01-01", days), value: 21 },
        ],
        "body_fat_pct",
      );

    it("should keep a gap of 30 days in one segment and fill the days between", () => {
      const points = gapOf(30);

      expect(new Set(points.map((point) => point.segment))).toStrictEqual(new Set([0]));
      expect(points).toHaveLength(31);
    });

    it("should start a new segment after a gap of 31 days, restarting the trend", () => {
      const points = gapOf(31);

      expect(points.map((point) => point.segment)).toStrictEqual([0, 1]);
      expect(points[1]).toMatchObject({ trend: 21, nObs: 1, interpolated: false });
    });
  });

  describe("values outside the bounds", () => {
    it.each<[BodyMeasurementKind, number[], number[]]>([
      ["body_fat_pct", [0.99, 75.01, 0, -3], [1, 75]],
      ["lean_mass_kg", [9.99, 300.01, 0, -3], [10, 300]],
    ])("should ignore, and not throw for, %s readings %j", (kind, outside, inside) => {
      const readings = consecutive("2026-10-15", [...outside, ...inside]);

      const points = computeBodyTrend(readings, kind);

      expect(points.map((point) => point.raw)).toStrictEqual(inside);
      expect(points.map((point) => point.date)).toStrictEqual(
        readings.slice(outside.length).map((reading) => reading.localDate),
      );
    });

    it("should give no points when every reading is outside the bounds", () => {
      expect(computeBodyTrend(consecutive("2026-10-15", [0.5, 80]), "body_fat_pct")).toStrictEqual(
        [],
      );
    });

    it("should apply the bounds of the kind, so 5 is a body fat and not a lean mass", () => {
      const readings = consecutive("2026-10-15", [5]);

      expect(computeBodyTrend(readings, "body_fat_pct")).toHaveLength(1);
      expect(computeBodyTrend(readings, "lean_mass_kg")).toHaveLength(0);
    });
  });

  describe("the winsor band", () => {
    it("should feed a 30.0 after six steady 22.0 days as 24.2, the 10 per cent band, for body fat", () => {
      const points = computeBodyTrend(
        consecutive("2026-10-15", [22, 22, 22, 22, 22, 22, 30]),
        "body_fat_pct",
      );
      const last = points.at(-1);

      expect(last?.trend).toBeCloseTo(expectedTrend([22, 22, 22, 22, 22, 22, 24.2]).at(-1) ?? 0, 9);
      expect(last?.trend).not.toBeCloseTo(
        expectedTrend([22, 22, 22, 22, 22, 22, 30]).at(-1) ?? 0,
        3,
      );
    });

    it("should neither reject the 30.0 nor drop it from nObs", () => {
      const last = computeBodyTrend(
        consecutive("2026-10-15", [22, 22, 22, 22, 22, 22, 30]),
        "body_fat_pct",
      ).at(-1);

      expect(last).toMatchObject({ raw: 30, nObs: 7, interpolated: false });
    });

    it("should feed a lean mass of 100 after six steady 60 days as 63, the 5 per cent band", () => {
      const last = computeBodyTrend(
        consecutive("2026-10-15", [60, 60, 60, 60, 60, 60, 100]),
        "lean_mass_kg",
      ).at(-1);

      expect(last?.trend).toBeCloseTo(expectedTrend([60, 60, 60, 60, 60, 60, 63]).at(-1) ?? 0, 9);
      expect(last?.nObs).toBe(7);
    });

    it.each<[BodyMeasurementKind, number[], number]>([
      ["body_fat_pct", [22, 22, 22, 22, 22, 22, 30, 22], 24.2],
      ["lean_mass_kg", [60, 60, 60, 60, 60, 60, 100, 60], 63],
    ])(
      "should not reject a spike that the next reading disagrees with, for %s readings %j",
      (kind, values, clamped) => {
        const points = computeBodyTrend(consecutive("2026-10-15", values), kind);
        const fed = [...values.slice(0, 6), clamped, values[7] ?? Number.NaN];

        // The engine would reject the spike under a 15 per cent rule, and keep it here.
        expect(points).toHaveLength(8);
        expect(points[6]).toMatchObject({ interpolated: false, raw: values[6], nObs: 7 });
        expect(points[6]?.trend).toBeCloseTo(expectedTrend(fed)[6] ?? Number.NaN, 9);
        expect(points[7]).toMatchObject({ interpolated: false, nObs: 8 });
      },
    );

    it("should clamp nothing before five readings", () => {
      const values = [22, 22, 22, 22, 30];

      const last = computeBodyTrend(consecutive("2026-10-15", values), "body_fat_pct").at(-1);

      expect(last?.trend).toBeCloseTo(expectedTrend(values).at(-1) ?? 0, 9);
    });

    it("should clamp a low reading to the band below the trend too", () => {
      const last = computeBodyTrend(
        consecutive("2026-10-15", [22, 22, 22, 22, 22, 22, 5]),
        "body_fat_pct",
      ).at(-1);

      expect(last?.trend).toBeCloseTo(expectedTrend([22, 22, 22, 22, 22, 22, 19.8]).at(-1) ?? 0, 9);
    });
  });

  describe("bad input", () => {
    it.each([
      ["a malformed date", { localDate: "2026-13-45", value: 22.123 }],
      ["a date with the wrong shape", { localDate: "15/10/2026", value: 22.123 }],
      ["a value that is not a number", { localDate: "2026-10-15", value: Number.NaN }],
      ["an infinite value", { localDate: "2026-10-15", value: Number.POSITIVE_INFINITY }],
      ["a malformed date and a value outside the bounds", { localDate: "2026-13-45", value: 0.5 }],
    ])("should throw a RangeError for %s that states the rule and holds no value", (_, reading) => {
      const act = (): BodyTrendPoint[] => computeBodyTrend([reading], "body_fat_pct");
      // A message that holds none of the dates or values used above.
      const holdsNoValue = /^(?!.*(22\.123|0\.5|2026|NaN|Infinity|15\/10)).+$/;

      expect(act).toThrow(RangeError);
      expect(act).toThrow(holdsNoValue);
    });

    it("should throw before any maths, even when the bad reading is also out of bounds", () => {
      expect(() =>
        computeBodyTrend([{ localDate: "2026-10-15", value: Number.NaN }], "lean_mass_kg"),
      ).toThrow(RangeError);
    });
  });
});
