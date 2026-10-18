import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { addCalendarDays } from "../../src/dates";
import { computeTrend } from "../../src/engine";

import type { TrendInput, TrendPoint } from "../../src/engine";

const START = "2026-01-01";

/**
 * Every reading sits within 0.3% of a base weight, so the trend and every reading stay well inside
 * the 2.5% winsor band and nothing is clamped or rejected. `expectNoSpikeHandling` asserts it, so a
 * generator that drifts out of the band fails loudly and does not quietly test less.
 */
const BASE_KG = fc.double({ min: 60, max: 150, noNaN: true });
const NOISE = fc.double({ min: -0.003, max: 0.003, noNaN: true });
/** Days since the first reading. Gaps of up to 40 days, so some series split into segments. */
const GAPS = fc.array(fc.integer({ min: 1, max: 40 }), { minLength: 1, maxLength: 40 });

type Series = Readonly<{ baseKg: number; readings: readonly TrendInput[] }>;

const series: fc.Arbitrary<Series> = fc.tuple(BASE_KG, GAPS).chain(([baseKg, gaps]) => {
  const dates = gaps.reduce<string[]>(
    (days, gap) => [...days, addCalendarDays(days.at(-1) ?? START, gap)],
    [START],
  );
  return fc
    .array(fc.array(NOISE, { minLength: 1, maxLength: 3 }), {
      minLength: dates.length,
      maxLength: dates.length,
    })
    .map((noisePerDate) => ({
      baseKg,
      readings: dates.flatMap((localDate, index) =>
        (noisePerDate[index] ?? []).map((noise) => ({
          localDate,
          weightKg: baseKg * (1 + noise),
        })),
      ),
    }));
});

function expectNoSpikeHandling(points: readonly TrendPoint[]): void {
  expect(points.filter((point) => point.rejected || point.winsorised)).toStrictEqual([]);
}

describe("computeTrend properties", () => {
  it("should reproduce a constant input exactly on every day", () => {
    fc.assert(
      fc.property(fc.double({ min: 20, max: 400, noNaN: true }), GAPS, (constantKg, gaps) => {
        const readings = gaps.reduce<TrendInput[]>(
          (days, gap) => [
            ...days,
            {
              localDate: addCalendarDays(days.at(-1)?.localDate ?? START, gap),
              weightKg: constantKg,
            },
          ],
          [{ localDate: START, weightKg: constantKg }],
        );

        const points = computeTrend(readings);

        expectNoSpikeHandling(points);
        expect(
          points.map((point) => point.trendKg).every((trendKg) => trendKg === constantKg),
        ).toBe(true);
        expect(points.map((point) => point.usedKg).every((usedKg) => usedKg === constantKg)).toBe(
          true,
        );
      }),
    );
  });

  it("should shift every trendKg by k when every reading is shifted by k", () => {
    fc.assert(
      fc.property(
        series,
        fc.double({ min: -10, max: 40, noNaN: true }),
        ({ readings }, shiftKg) => {
          const shifted = readings.map(({ localDate, weightKg }) => ({
            localDate,
            weightKg: weightKg + shiftKg,
          }));

          const before = computeTrend(readings);
          const after = computeTrend(shifted);

          expectNoSpikeHandling(before);
          expectNoSpikeHandling(after);
          expect(after.map((point) => point.date)).toStrictEqual(before.map((point) => point.date));
          before.forEach((point, index) => {
            expect(
              Math.abs((after[index]?.trendKg ?? Number.NaN) - (point.trendKg + shiftKg)),
            ).toBeLessThan(1e-9);
          });
        },
      ),
    );
  });

  it("should keep every trendKg between the min and max usedKg seen so far in its segment", () => {
    fc.assert(
      fc.property(series, ({ readings }) => {
        const points = computeTrend(readings);
        const seen = new Map<number, { min: number; max: number }>();

        expectNoSpikeHandling(points);
        for (const point of points) {
          const range = seen.get(point.segment);
          const min = Math.min(range?.min ?? point.usedKg, point.usedKg);
          const max = Math.max(range?.max ?? point.usedKg, point.usedKg);
          seen.set(point.segment, { min, max });

          expect(point.trendKg).toBeGreaterThanOrEqual(min - 1e-9);
          expect(point.trendKg).toBeLessThanOrEqual(max + 1e-9);
        }
      }),
    );
  });

  it("should give identical output for a shuffled input", () => {
    fc.assert(
      fc.property(
        series.chain(({ readings }) =>
          fc.record({
            readings: fc.constant(readings),
            shuffled: fc.shuffledSubarray([...readings], {
              minLength: readings.length,
              maxLength: readings.length,
            }),
          }),
        ),
        ({ readings, shuffled }) => {
          const expected = computeTrend(readings);

          expectNoSpikeHandling(expected);
          expect(computeTrend(shuffled)).toStrictEqual(expected);
        },
      ),
    );
  });

  it("should give identical output when every reading is repeated", () => {
    fc.assert(
      fc.property(series, ({ readings }) => {
        const expected = computeTrend(readings);

        expectNoSpikeHandling(expected);
        expect(computeTrend(readings.flatMap((reading) => [reading, reading]))).toStrictEqual(
          expected,
        );
      }),
    );
  });

  it("should lag a 60-day ramp of -0.05 kg per day by about 0.45 kg at the end", () => {
    fc.assert(
      fc.property(fc.double({ min: 70, max: 120, noNaN: true }), (startKg) => {
        const readings = Array.from({ length: 60 }, (_, day) => ({
          localDate: addCalendarDays(START, day),
          weightKg: startKg - 0.05 * day,
        }));

        const points = computeTrend(readings);
        const last = points.at(-1);

        expect(points).toHaveLength(60);
        expectNoSpikeHandling(points);
        // The trend of a falling series sits above the true line. Steady state is slope * (1 - alpha) / alpha.
        const lagKg = (last?.trendKg ?? Number.NaN) - (startKg - 0.05 * 59);
        expect(lagKg).toBeGreaterThan(0.44);
        expect(lagKg).toBeLessThan(0.46);
      }),
    );
  });

  it("should not change the array it is given and should give the same output twice", () => {
    fc.assert(
      fc.property(series, ({ readings }) => {
        const input = readings.map((reading) => ({ ...reading }));
        const before = structuredClone(input);

        const first = computeTrend(input);
        const second = computeTrend(input);

        expect(input).toStrictEqual(before);
        expect(second).toStrictEqual(first);
      }),
    );
  });
});
