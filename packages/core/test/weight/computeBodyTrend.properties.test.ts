import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { addCalendarDays } from "../../src/dates";
import {
  BODY_FAT_MAX_PCT,
  BODY_FAT_MIN_PCT,
  LEAN_MASS_MAX_KG,
  LEAN_MASS_MIN_KG,
  computeBodyTrend,
} from "../../src/weight";

import type { BodyMeasurementKind, BodyReading } from "../../src/weight";

const START = "2026-01-01";

type KindCase = Readonly<{ kind: BodyMeasurementKind; min: number; max: number }>;

const KIND_CASES: readonly KindCase[] = [
  { kind: "body_fat_pct", min: BODY_FAT_MIN_PCT, max: BODY_FAT_MAX_PCT },
  { kind: "lean_mass_kg", min: LEAN_MASS_MIN_KG, max: LEAN_MASS_MAX_KG },
];

/** Days since the previous reading date. Gaps of up to 40 days, so some series split into segments. */
const GAPS = fc.array(fc.integer({ min: 1, max: 40 }), { minLength: 1, maxLength: 40 });

function datesFrom(gaps: readonly number[]): string[] {
  return gaps.reduce<string[]>(
    (days, gap) => [...days, addCalendarDays(days.at(-1) ?? START, gap)],
    [START],
  );
}

/** Readings anywhere inside the bounds, one to three a date, so the winsor band is exercised. */
function wideSeries({ min, max }: KindCase): fc.Arbitrary<BodyReading[]> {
  return GAPS.chain((gaps) => {
    const dates = datesFrom(gaps);
    return fc
      .array(fc.array(fc.double({ min, max, noNaN: true }), { minLength: 1, maxLength: 3 }), {
        minLength: dates.length,
        maxLength: dates.length,
      })
      .map((valuesPerDate) =>
        dates.flatMap((localDate, index) =>
          (valuesPerDate[index] ?? []).map((value) => ({ localDate, value })),
        ),
      );
  });
}

/**
 * Every reading sits within 0.3% of a base value, far inside the winsor band, so nothing is clamped.
 * Shifting the readings moves the band with the trend, so only a series like this is shift invariant.
 */
const SHIFT_BASE = { body_fat_pct: { min: 10, max: 40 }, lean_mass_kg: { min: 30, max: 150 } };

function narrowSeries(kind: BodyMeasurementKind): fc.Arbitrary<BodyReading[]> {
  return fc.tuple(fc.double({ ...SHIFT_BASE[kind], noNaN: true }), GAPS).chain(([base, gaps]) => {
    const dates = datesFrom(gaps);
    return fc
      .array(fc.double({ min: -0.003, max: 0.003, noNaN: true }), {
        minLength: dates.length,
        maxLength: dates.length,
      })
      .map((noises) =>
        dates.map((localDate, index) => ({ localDate, value: base * (1 + (noises[index] ?? 0)) })),
      );
  });
}

describe.each(KIND_CASES)("computeBodyTrend properties for $kind", (kindCase) => {
  const { kind, min, max } = kindCase;

  it("should reproduce a constant input exactly on every day", () => {
    fc.assert(
      fc.property(fc.double({ min, max, noNaN: true }), GAPS, (constant, gaps) => {
        const readings = datesFrom(gaps).map((localDate) => ({ localDate, value: constant }));

        const points = computeBodyTrend(readings, kind);

        expect(points.length).toBeGreaterThan(0);
        expect(points.every((point) => point.trend === constant)).toBe(true);
      }),
    );
  });

  it("should keep every trend between the min and max of the readings in its segment", () => {
    fc.assert(
      fc.property(wideSeries(kindCase), (readings) => {
        const points = computeBodyTrend(readings, kind);
        // An interpolated day leans on the next reading, so the whole segment is the fair range.
        const rawRange = new Map<number, { low: number; high: number }>();
        for (const { segment, raw } of points) {
          const range = rawRange.get(segment);
          rawRange.set(segment, {
            low: Math.min(range?.low ?? Infinity, raw ?? Infinity),
            high: Math.max(range?.high ?? -Infinity, raw ?? -Infinity),
          });
        }

        for (const point of points) {
          const range = rawRange.get(point.segment);

          expect(point.trend).toBeGreaterThanOrEqual((range?.low ?? Infinity) - 1e-9);
          expect(point.trend).toBeLessThanOrEqual((range?.high ?? -Infinity) + 1e-9);
        }
      }),
    );
  });

  it("should shift every trend by k when every reading is shifted by k, inside the bounds", () => {
    fc.assert(
      fc.property(
        narrowSeries(kind),
        fc.double({ min: -5, max: 5, noNaN: true }),
        (readings, shift) => {
          const shifted = readings.map(({ localDate, value }) => ({
            localDate,
            value: value + shift,
          }));

          const before = computeBodyTrend(readings, kind);
          const after = computeBodyTrend(shifted, kind);

          expect(after.map((point) => point.date)).toStrictEqual(before.map((point) => point.date));
          before.forEach((point, index) => {
            expect(
              Math.abs((after[index]?.trend ?? Number.NaN) - (point.trend + shift)),
            ).toBeLessThan(1e-9);
          });
        },
      ),
    );
  });

  it("should give identical output for a shuffled input", () => {
    fc.assert(
      fc.property(
        wideSeries(kindCase).chain((readings) =>
          fc.record({
            readings: fc.constant(readings),
            shuffled: fc.shuffledSubarray([...readings], {
              minLength: readings.length,
              maxLength: readings.length,
            }),
          }),
        ),
        ({ readings, shuffled }) => {
          expect(computeBodyTrend(shuffled, kind)).toStrictEqual(computeBodyTrend(readings, kind));
        },
      ),
    );
  });

  it("should give identical output when every reading is repeated", () => {
    fc.assert(
      fc.property(wideSeries(kindCase), (readings) => {
        expect(
          computeBodyTrend(
            readings.flatMap((reading) => [reading, reading]),
            kind,
          ),
        ).toStrictEqual(computeBodyTrend(readings, kind));
      }),
    );
  });

  it("should not change the array it is given and should give the same output twice", () => {
    fc.assert(
      fc.property(wideSeries(kindCase), (readings) => {
        const before = structuredClone(readings);

        const first = computeBodyTrend(readings, kind);

        expect(readings).toStrictEqual(before);
        expect(computeBodyTrend(readings, kind)).toStrictEqual(first);
      }),
    );
  });
});
