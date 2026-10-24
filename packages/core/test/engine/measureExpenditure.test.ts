import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { addCalendarDays } from "../../src/dates";
import { computeTrend, DEFAULT_ENGINE_PARAMS, measureExpenditure } from "../../src/engine";

import type { DayInput, TrendInput, TrendPoint } from "../../src/engine";

/*
 * Every expected figure below is a literal. The golden table is the one in ADR 0002, Amendment 2. The
 * other figures come from a separate script that does plain ordinary least squares from the formulas in
 * the ADR (nothing imported from the module under test), and are pasted here to the digits shown.
 */

const AS_OF = "2026-04-30";
const WINDOW_START = addCalendarDays(AS_OF, -28);

/** The date `index` days into the window: 0 is `as_of - 28`, 27 is `as_of - 1`, 28 is `as_of` itself. */
const dateAt = (index: number): string => addCalendarDays(WINDOW_START, index);

function realPoint(index: number, kg: number): TrendPoint {
  return {
    date: dateAt(index),
    segment: 0,
    trendKg: kg,
    rawKg: kg,
    usedKg: kg,
    rejected: false,
    winsorised: false,
    interpolated: false,
    nObs: 1,
  };
}

function interpolatedPoint(index: number, kg: number): TrendPoint {
  return { ...realPoint(index, kg), rawKg: null, interpolated: true };
}

function rejectedPoint(index: number, kg: number): TrendPoint {
  return { ...realPoint(index, kg), rejected: true };
}

function winsorisedPoint(index: number, rawKg: number, usedKg: number): TrendPoint {
  return { ...realPoint(index, usedKg), rawKg, winsorised: true };
}

function completeDay(index: number, intakeKcal: number): DayInput {
  return { localDate: dateAt(index), intakeKcal, isComplete: true };
}

function incompleteDay(index: number, intakeKcal: number): DayInput {
  return { localDate: dateAt(index), intakeKcal, isComplete: false };
}

/** A day the user marked complete that has no logged intake, so it is not a complete day. */
function completeDayWithoutIntake(index: number): DayInput {
  return { localDate: dateAt(index), intakeKcal: null, isComplete: true };
}

function range(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
}

/** A weigh-in on each of the given window days, falling by `kgPerDay` from 80 kg on the first of them. */
function linearWeights(indices: readonly number[], kgPerDay: number): TrendPoint[] {
  const first = indices[0] ?? 0;
  return indices.map((index) => realPoint(index, 80 + kgPerDay * (index - first)));
}

function completeDays(indices: readonly number[], intakeKcal: number): DayInput[] {
  return indices.map((index) => completeDay(index, intakeKcal));
}

function expectWithin(actual: number, expected: number, tolerance: number): void {
  expect(actual).toBeGreaterThanOrEqual(expected - tolerance);
  expect(actual).toBeLessThanOrEqual(expected + tolerance);
}

describe("measureExpenditure golden table (ADR 0002, Amendment 2)", () => {
  // Weight exactly 80 - 0.05 * d, intake 2200 on every day, all complete, data from day 0.
  const START = "2026-04-02";
  const weighIns: TrendInput[] = range(0, 27).map((day) => ({
    localDate: addCalendarDays(START, day),
    weightKg: 80 - 0.05 * day,
  }));
  const intakeDays: DayInput[] = range(0, 27).map((day) => ({
    localDate: addCalendarDays(START, day),
    intakeKcal: 2200,
    isComplete: true,
  }));

  function checkIn(daysAfterStart: number) {
    const asOfDate = addCalendarDays(START, daysAfterStart);
    const trend = computeTrend(weighIns.filter(({ localDate }) => localDate < asOfDate));
    return measureExpenditure({ asOfDate, trend, days: intakeDays });
  }

  // Columns: check-in day, spanDays, sum of squares of x about its mean, seSlopeKg, R_eff from the ADR
  // and R_eff from the Build Plan (each within 0.5).
  it.each([
    [14, 14, 227.5, 0.0198898, 62467.9, 62467.8],
    [21, 21, 770, 0.0108112, 36347.1, 36347.4],
    [28, 28, 1827, 0.0070186, 27239.9, 27240.0],
  ])(
    "should measure the check-in on day %i of the data (spread %f, se %f)",
    (daysAfterStart, spanDays, spread, seSlopeKg, rKcal2FromAdr, rKcal2FromBuildPlan) => {
      const result = checkIn(daysAfterStart);

      expect(result.eligible).toBe(true);
      if (!result.eligible) return;
      expect(result.spanDays).toBe(spanDays);
      expect(result.weighDays).toBe(spanDays);
      expect(result.completeDays).toBe(spanDays);
      expectWithin(result.seSlopeKg, seSlopeKg, 1e-7);
      // The residual sd is 0, so the floor applies and the spread is the floor squared over se squared.
      expectWithin(0.3 ** 2 / result.seSlopeKg ** 2, spread, 0.01);
      expectWithin(result.rKcal2, rKcal2FromAdr, 0.5);
      expectWithin(result.rKcal2, rKcal2FromBuildPlan, 0.5);
      expectWithin(result.slopeKgPerDay, -0.05, 1e-9);
      expect(result.meanIntakeKcal).toBe(2200);
      expectWithin(result.zKcal, 2585, 1e-6);
    },
  );

  it("should not penalise the days before the data began, so the first check-in has no penalty", () => {
    const result = checkIn(14);

    if (!result.eligible) throw new Error("expected an eligible measurement");
    // With a penalty of (100 * 0.5)^2 over all 28 days it would be 67 467.9.
    expectWithin(result.rKcal2, 62467.9, 0.5);
  });
});

describe("measureExpenditure on a noisy window", () => {
  // Window days 8 to 27 hold data. Weigh-ins on 11 days spanning days 8 to 23, the one on day 16
  // winsorised from 84.5 to 81.9. Intake on days 8 to 27: five incomplete days (11, 17, 19, 22, 25) and
  // day 26 marked complete with no intake, so 14 complete days of the 20 days from the first data.
  // Decoys that must not count: an interpolated day (14), a rejected day (19), and a weigh-in and a
  // complete day of 9000 kcal outside the window on both sides (the day before the window and the check-in day).
  const weights = [
    realPoint(8, 80.4),
    realPoint(9, 79.1),
    realPoint(10, 80.9),
    realPoint(12, 79.6),
    realPoint(13, 80.2),
    interpolatedPoint(14, 99),
    realPoint(15, 78.9),
    winsorisedPoint(16, 84.5, 81.9),
    realPoint(18, 79.3),
    rejectedPoint(19, 99),
    realPoint(20, 79.8),
    realPoint(21, 78.6),
    realPoint(23, 79.9),
    realPoint(-1, 120),
    realPoint(28, 120),
  ];
  const intakes = [
    2100, 2350, 1980, 2410, 2230, 2050, 2600, 2150, 1890, 2320, 2475, 2040, 2260, 2180, 1950, 2390,
    2210, 2070,
  ];
  const incompleteIndices = new Set([11, 17, 19, 22, 25]);
  const days: DayInput[] = [
    ...intakes.map((kcal, offset) => {
      const index = 8 + offset;
      return incompleteIndices.has(index) ? incompleteDay(index, kcal) : completeDay(index, kcal);
    }),
    completeDayWithoutIntake(26),
    completeDay(27, 2300),
    completeDay(-1, 9000),
    completeDay(28, 9000),
  ];
  const result = measureExpenditure({ asOfDate: AS_OF, trend: weights, days });

  it("should count the real weigh days and the span, and the complete days", () => {
    if (!result.eligible) throw new Error("expected an eligible measurement");
    expect(result.weighDays).toBe(11);
    expect(result.spanDays).toBe(16);
    expect(result.completeDays).toBe(14);
  });

  it("should regress the winsorised weight at its clamped value for a slope of -0.0445736 kg a day", () => {
    if (!result.eligible) throw new Error("expected an eligible measurement");
    expectWithin(result.slopeKgPerDay, -0.04457364341, 1e-9);
  });

  it("should divide the residuals by n - 2, so the standard error of the slope is 0.0608907", () => {
    if (!result.eligible) throw new Error("expected an eligible measurement");
    expectWithin(result.seSlopeKg, 0.06089068049, 1e-9);
  });

  it("should average the intake over the complete days only", () => {
    if (!result.eligible) throw new Error("expected an eligible measurement");
    expectWithin(result.meanIntakeKcal, 2226.07142857, 1e-6);
  });

  it("should give an expenditure of 2569.2885 kcal", () => {
    if (!result.eligible) throw new Error("expected an eligible measurement");
    expectWithin(result.zKcal, 2569.28848283, 1e-6);
  });

  it("should give a variance of 522 724.743 with the penalty of 14 complete days in 20, inflated by 16 over 7", () => {
    if (!result.eligible) throw new Error("expected an eligible measurement");
    // Over all 28 days the fraction would be 14 / 28 and the variance 526 381.886 instead.
    expectWithin(result.rKcal2, 522724.7431, 1e-3);
  });

  it("should give the same result for a trend that holds only the days the window uses", () => {
    const inWindowOnly = weights.filter(({ date }) => date >= dateAt(0) && date < AS_OF);
    const inWindowDays = days.filter(
      ({ localDate }) => localDate >= dateAt(0) && localDate < AS_OF,
    );

    expect(
      measureExpenditure({ asOfDate: AS_OF, trend: inWindowOnly, days: inWindowDays }),
    ).toStrictEqual(result);
  });
});

describe("measureExpenditure window", () => {
  it("should include as_of - 28 and exclude as_of - 29", () => {
    const weights = [realPoint(-1, 90), ...linearWeights(range(0, 13), -0.05)];

    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: weights,
      days: completeDays(range(0, 13), 2200),
    });

    expect(result).toMatchObject({ eligible: true, spanDays: 14, weighDays: 14 });
  });

  it("should include as_of - 1 and exclude as_of itself", () => {
    const weights = [...linearWeights(range(14, 27), -0.05), realPoint(28, 90)];

    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: weights,
      days: [...completeDays(range(14, 27), 2200), completeDay(28, 2200)],
    });

    expect(result).toMatchObject({
      eligible: true,
      spanDays: 14,
      weighDays: 14,
      completeDays: 14,
    });
  });

  it("should give the same window whichever day of the month the check-in is", () => {
    const asOfDate = "2026-03-01";
    const start = addCalendarDays(asOfDate, -28);
    const trend = range(0, 13).map((index) => ({
      ...realPoint(index, 80 - 0.05 * index),
      date: addCalendarDays(start, index),
    }));
    const days = range(0, 13).map((index) => ({
      localDate: addCalendarDays(start, index),
      intakeKcal: 2200,
      isComplete: true,
    }));

    expect(measureExpenditure({ asOfDate, trend, days })).toMatchObject({
      eligible: true,
      spanDays: 14,
    });
  });
});

describe("measureExpenditure which days count", () => {
  it("should not count interpolated days as weigh days", () => {
    const realDays = [14, 16, 18, 20, 22, 24, 26, 27];
    const weights = [
      ...linearWeights(realDays, -0.05),
      ...[15, 17, 19, 21, 23, 25].map((index) => interpolatedPoint(index, 80)),
    ];

    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: weights,
      days: completeDays(range(14, 27), 2200),
    });

    expect(result).toMatchObject({ eligible: true, spanDays: 14, weighDays: 8 });
  });

  it("should not count a day flagged interpolated even when it carries a reading", () => {
    const weights = [
      ...linearWeights(range(14, 21), -0.05),
      { ...interpolatedPoint(27, 80), rawKg: 80 },
    ];

    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: weights,
      days: completeDays(range(14, 27), 2200),
    });

    expect(result).toMatchObject({ eligible: false, spanDays: 8, weighDays: 8 });
  });

  it("should not count rejected days as weigh days or towards the span", () => {
    const weights = [
      ...linearWeights(range(14, 21), -0.05),
      ...[22, 23, 27].map((index) => rejectedPoint(index, 99)),
    ];

    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: weights,
      days: completeDays(range(14, 27), 2200),
    });

    expect(result).toStrictEqual({
      eligible: false,
      reasons: ["span"],
      spanDays: 8,
      weighDays: 8,
      completeDays: 14,
    });
  });

  it("should not count a day without a reading as a weigh day", () => {
    const weights = [...linearWeights(range(14, 21), -0.05), { ...realPoint(27, 80), rawKg: null }];

    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: weights,
      days: completeDays(range(14, 27), 2200),
    });

    expect(result).toMatchObject({ eligible: false, spanDays: 8, weighDays: 8 });
  });

  it("should count a winsorised day with its clamped weight", () => {
    // Eight real days falling 0.1 kg a day, and a ninth on day 27 clamped to 78.3 from a raw 90.
    const weights = [
      ...linearWeights(range(14, 20), -0.1),
      realPoint(21, 79.3),
      winsorisedPoint(27, 90, 78.3),
    ];

    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: weights,
      days: completeDays(range(14, 27), 2200),
    });

    expect(result).toMatchObject({ eligible: true, spanDays: 14, weighDays: 9 });
  });

  it("should not count a day marked complete with no intake as complete", () => {
    const days = [...completeDays(range(14, 22), 2200), completeDayWithoutIntake(23)];

    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: linearWeights(range(14, 27), -0.05),
      days,
    });

    expect(result).toStrictEqual({
      eligible: false,
      reasons: ["complete_days"],
      spanDays: 14,
      weighDays: 14,
      completeDays: 9,
    });
  });

  it("should not count an incomplete day as complete, nor average its intake", () => {
    const days = [...completeDays(range(14, 23), 2200), incompleteDay(24, 9000)];

    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: linearWeights(range(14, 27), -0.05),
      days,
    });

    expect(result).toMatchObject({ eligible: true, completeDays: 10, meanIntakeKcal: 2200 });
  });
});

describe("measureExpenditure completeFrac counts from the first day with any data", () => {
  it("should start at a weigh-in that comes before the first intake", () => {
    // Weigh-ins on days 10 to 23, complete intake on days 14 to 27: 14 complete days of 18.
    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: linearWeights(range(10, 23), -0.05),
      days: completeDays(range(14, 27), 2200),
    });

    if (!result.eligible) throw new Error("expected an eligible measurement");
    expectWithin(result.rKcal2, 63455.566, 1e-2);
  });

  it("should start at an intake that comes before the first weigh-in", () => {
    // Complete intake on days 10 to 23, weigh-ins on days 14 to 27: 14 complete days of 18.
    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: linearWeights(range(14, 27), -0.05),
      days: completeDays(range(10, 23), 2200),
    });

    if (!result.eligible) throw new Error("expected an eligible measurement");
    expectWithin(result.rKcal2, 63455.566, 1e-2);
  });

  it("should not start at a day whose only entry is a rejected weigh-in", () => {
    // A rejected point on day 10, then real data from day 14: 14 days of data, so no penalty.
    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: [rejectedPoint(10, 99), ...linearWeights(range(14, 27), -0.05)],
      days: completeDays(range(14, 27), 2200),
    });

    if (!result.eligible) throw new Error("expected an eligible measurement");
    expectWithin(result.rKcal2, 62467.9, 0.5);
  });

  it("should count an incomplete day with an intake as a day with data", () => {
    // Complete intake on days 14 to 27 and an incomplete day on 12: 14 complete days of 16.
    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: linearWeights(range(14, 27), -0.05),
      days: [incompleteDay(12, 1800), ...completeDays(range(14, 27), 2200)],
    });

    if (!result.eligible) throw new Error("expected an eligible measurement");
    // R is 23 455.4 + 7 778.6 + (100 * 2 / 16)^2 = 31 390.2, times 14 / 7.
    expectWithin(result.rKcal2, 62780.412, 1e-2);
  });
});

describe("measureExpenditure eligibility", () => {
  const fullWeights = linearWeights(range(14, 27), -0.05);
  const fullDays = completeDays(range(14, 27), 2200);

  it("should be eligible at a span of 14, 8 weigh days and 10 complete days", () => {
    const weights = linearWeights([14, 15, 17, 19, 21, 23, 25, 27], -0.05);

    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: weights,
      days: completeDays(range(14, 23), 2200),
    });

    expect(result).toMatchObject({
      eligible: true,
      spanDays: 14,
      weighDays: 8,
      completeDays: 10,
    });
  });

  it("should fail on a span of 13 days with the reason span", () => {
    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: linearWeights(range(15, 27), -0.05),
      days: fullDays,
    });

    expect(result).toStrictEqual({
      eligible: false,
      reasons: ["span"],
      spanDays: 13,
      weighDays: 13,
      completeDays: 14,
    });
  });

  it("should fail on 7 weigh days with the reason weigh_days", () => {
    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: linearWeights([14, 15, 17, 19, 21, 23, 27], -0.05),
      days: fullDays,
    });

    expect(result).toStrictEqual({
      eligible: false,
      reasons: ["weigh_days"],
      spanDays: 14,
      weighDays: 7,
      completeDays: 14,
    });
  });

  it("should fail on 9 complete days with the reason complete_days", () => {
    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: fullWeights,
      days: completeDays(range(14, 22), 2200),
    });

    expect(result).toStrictEqual({
      eligible: false,
      reasons: ["complete_days"],
      spanDays: 14,
      weighDays: 14,
      completeDays: 9,
    });
  });

  it("should give all three reasons in the order span, weigh_days, complete_days", () => {
    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: linearWeights([15, 16, 17, 18, 19, 21, 27], -0.05),
      days: completeDays(range(14, 22), 2200),
    });

    expect(result).toStrictEqual({
      eligible: false,
      reasons: ["span", "weigh_days", "complete_days"],
      spanDays: 13,
      weighDays: 7,
      completeDays: 9,
    });
  });

  it("should give a span of 0 and three reasons when there is no data at all", () => {
    expect(measureExpenditure({ asOfDate: AS_OF, trend: [], days: [] })).toStrictEqual({
      eligible: false,
      reasons: ["span", "weigh_days", "complete_days"],
      spanDays: 0,
      weighDays: 0,
      completeDays: 0,
    });
  });

  it("should read the thresholds from the params it is given", () => {
    const relaxed = {
      ...DEFAULT_ENGINE_PARAMS,
      expenditure: { ...DEFAULT_ENGINE_PARAMS.expenditure, minWeighDays: 7 },
    };

    const result = measureExpenditure(
      {
        asOfDate: AS_OF,
        trend: linearWeights([14, 15, 17, 19, 21, 23, 27], -0.05),
        days: fullDays,
      },
      relaxed,
    );

    expect(result).toMatchObject({ eligible: true, weighDays: 7 });
  });
});

describe("measureExpenditure expenditure clamp", () => {
  it("should clamp to 800 kcal for an intake of 200 with a gaining slope", () => {
    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: linearWeights(range(14, 27), 0.05),
      days: completeDays(range(14, 27), 200),
    });

    if (!result.eligible) throw new Error("expected an eligible measurement");
    // Unclamped it would be 200 - 0.05 * 7700 = -185.
    expect(result.zKcal).toBe(800);
  });

  it("should clamp to 6000 kcal for an intake of 5000 with a fast losing slope", () => {
    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: linearWeights(range(14, 27), -0.2),
      days: completeDays(range(14, 27), 5000),
    });

    if (!result.eligible) throw new Error("expected an eligible measurement");
    // Unclamped it would be 5000 + 0.2 * 7700 = 6540.
    expect(result.zKcal).toBe(6000);
  });
});

describe("measureExpenditure duplicate dates", () => {
  it("should let the later entry for a date win, in the trend and in the days", () => {
    // A stale weight of 99 kg and an intake of 1000 come before the entries that stand.
    const result = measureExpenditure({
      asOfDate: AS_OF,
      trend: [realPoint(27, 99), ...linearWeights(range(14, 27), -0.05)],
      days: [completeDay(14, 1000), ...completeDays(range(14, 27), 2200)],
    });

    if (!result.eligible) throw new Error("expected an eligible measurement");
    expectWithin(result.slopeKgPerDay, -0.05, 1e-9);
    expect(result.meanIntakeKcal).toBe(2200);
  });
});

describe("measureExpenditure properties", () => {
  const WEIGHT_KG = fc.double({ min: 50, max: 150, noNaN: true });
  const INTAKE_KCAL = fc.integer({ min: 500, max: 5000 });

  /** Real weigh-ins and complete days on every one of the last 14 days of the window. */
  const eligibleWindow = fc
    .record({
      weights: fc.array(WEIGHT_KG, { minLength: 14, maxLength: 14 }),
      intakes: fc.array(INTAKE_KCAL, { minLength: 14, maxLength: 14 }),
    })
    .map(({ weights, intakes }) => ({
      trend: weights.map((kg, offset) => realPoint(14 + offset, kg)),
      days: intakes.map((kcal, offset) => completeDay(14 + offset, kcal)),
    }));

  it("should always give a positive variance for an eligible window", () => {
    fc.assert(
      fc.property(eligibleWindow, ({ trend, days }) => {
        const result = measureExpenditure({ asOfDate: AS_OF, trend, days });

        expect(result.eligible).toBe(true);
        if (result.eligible) expect(result.rKcal2).toBeGreaterThan(0);
      }),
    );
  });

  it("should leave the expenditure unchanged when a constant is added to every weight", () => {
    fc.assert(
      fc.property(
        eligibleWindow,
        fc.double({ min: -20, max: 20, noNaN: true }),
        ({ trend, days }, shiftKg) => {
          const shifted = trend.map((point) => ({
            ...point,
            rawKg: (point.rawKg ?? 0) + shiftKg,
            usedKg: point.usedKg + shiftKg,
          }));

          const before = measureExpenditure({ asOfDate: AS_OF, trend, days });
          const after = measureExpenditure({ asOfDate: AS_OF, trend: shifted, days });

          if (!before.eligible || !after.eligible) throw new Error("expected eligible windows");
          expectWithin(after.zKcal, before.zKcal, 1e-6);
        },
      ),
    );
  });

  /** Any mix of weigh-in kinds and intake days over the whole window, eligible or not. */
  const anyWindow = fc
    .record({
      weighKinds: fc.array(fc.constantFrom("none", "real", "interpolated", "rejected"), {
        minLength: 28,
        maxLength: 28,
      }),
      weights: fc.array(WEIGHT_KG, { minLength: 28, maxLength: 28 }),
      intakes: fc.array(fc.option(INTAKE_KCAL, { nil: null }), { minLength: 28, maxLength: 28 }),
      completeFlags: fc.array(fc.boolean(), { minLength: 28, maxLength: 28 }),
    })
    .map(({ weighKinds, weights, intakes, completeFlags }) => ({
      trend: weighKinds.flatMap((kind, index): TrendPoint[] => {
        const kg = weights[index] ?? 80;
        if (kind === "real") return [realPoint(index, kg)];
        if (kind === "interpolated") return [interpolatedPoint(index, kg)];
        if (kind === "rejected") return [rejectedPoint(index, kg)];
        return [];
      }),
      days: intakes.map((intakeKcal, index): DayInput => ({
        localDate: dateAt(index),
        intakeKcal,
        isComplete: completeFlags[index] ?? false,
      })),
    }));

  it("should give the same result when the days and the trend are shuffled", () => {
    fc.assert(
      fc.property(
        anyWindow.chain(({ trend, days }) =>
          fc.record({
            trend: fc.shuffledSubarray(trend, { minLength: trend.length, maxLength: trend.length }),
            days: fc.shuffledSubarray(days, { minLength: days.length, maxLength: days.length }),
            original: fc.constant({ trend, days }),
          }),
        ),
        ({ trend, days, original }) => {
          expect(measureExpenditure({ asOfDate: AS_OF, trend, days })).toStrictEqual(
            measureExpenditure({ asOfDate: AS_OF, ...original }),
          );
        },
      ),
    );
  });
});
