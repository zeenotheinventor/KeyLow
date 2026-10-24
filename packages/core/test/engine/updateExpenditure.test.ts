import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { addCalendarDays } from "../../src/dates";
import {
  computeTrend,
  DEFAULT_ENGINE_PARAMS,
  measureExpenditure,
  updateExpenditure,
} from "../../src/engine";

import type {
  DayInput,
  EligibleMeasurement,
  EngineParams,
  ExpenditureBelief,
  ExpenditureUpdate,
  IneligibleMeasurement,
  TrendInput,
} from "../../src/engine";

/*
 * Every expected figure below is a literal. The golden chain is the table in ADR 0002, Amendment 2, and the
 * other figures come from a separate script that applies the formulas of the ADR (nothing imported from
 * the module under test), pasted here to the digits shown. Where the ADR and the Build Plan differ in the
 * last digit, both are asserted, because both are within the tolerance of the ADR.
 */

function expectWithin(actual: number, expected: number, tolerance: number): void {
  expect(actual).toBeGreaterThanOrEqual(expected - tolerance);
  expect(actual).toBeLessThanOrEqual(expected + tolerance);
}

function range(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
}

/** An eligible measurement that carries the figures the update reads and placeholder ones it ignores. */
function measurementOf(zKcal: number, rKcal2: number): EligibleMeasurement {
  return {
    eligible: true,
    zKcal,
    rKcal2,
    spanDays: 28,
    weighDays: 28,
    completeDays: 28,
    slopeKgPerDay: 0,
    seSlopeKg: 0.01,
    meanIntakeKcal: 2200,
  };
}

const INELIGIBLE: IneligibleMeasurement = {
  eligible: false,
  reasons: ["complete_days"],
  spanDays: 14,
  weighDays: 14,
  completeDays: 9,
};

const PRIOR: ExpenditureBelief = { muKcal: 2500, varKcal2: 140625 };

describe("updateExpenditure golden chain (ADR 0002, Amendment 2)", () => {
  // Weight exactly 80 - 0.05 * d, intake 2200 on every day, all complete, data from day 0, so z is 2585.
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

  function measureCheckIn(daysAfterStart: number): EligibleMeasurement {
    const asOfDate = addCalendarDays(START, daysAfterStart);
    const trend = computeTrend(weighIns.filter(({ localDate }) => localDate < asOfDate));
    const measurement = measureExpenditure({ asOfDate, trend, days: intakeDays });
    if (!measurement.eligible) throw new Error("expected an eligible measurement");
    return measurement;
  }

  // Columns: check-in day, the measurement's rKcal2 from the ADR (within 0.5), then mu from the ADR, var
  // from the ADR and var from the Build Plan (each within 0.5), the gain (within 1e-5) and the unclamped
  // step (within 0.01).
  const CHAIN = [
    [14, 62467.9, 2559.56, 43771.7, 43771.3, 0.70071, 59.56],
    [21, 36347.1, 2574.22, 20939.4, 20939.4, 0.5761, 14.66],
    [28, 27239.9, 2579.54, 13449.0, 13449.0, 0.49372, 5.32],
  ] as const;

  it("should reproduce the three check-ins of the chain, each feeding the next", () => {
    let belief: ExpenditureBelief = PRIOR;

    for (const [day, rKcal2, muKcal, varFromAdr, varFromBuildPlan, gain, rawStepKcal] of CHAIN) {
      const measurement = measureCheckIn(day);
      const update = updateExpenditure(belief, measurement);

      expectWithin(measurement.rKcal2, rKcal2, 0.5);
      expectWithin(update.muKcal, muKcal, 0.5);
      expectWithin(update.varKcal2, varFromAdr, 0.5);
      expectWithin(update.varKcal2, varFromBuildPlan, 0.5);
      expectWithin(update.gain, gain, 1e-5);
      expectWithin(update.rawStepKcal, rawStepKcal, 0.01);
      expect(update.stepKcal).toBe(update.rawStepKcal);
      expect(update.stepClamped).toBe(false);
      belief = update;
    }
  });

  it("should give the gain of the second check-in as 0.57610 by the ADR and 0.57609 by the Build Plan", () => {
    const first = updateExpenditure(PRIOR, measureCheckIn(14));
    const second = updateExpenditure(first, measureCheckIn(21));

    expectWithin(second.gain, 0.5761, 1e-5);
    expectWithin(second.gain, 0.57609, 1e-5);
  });
});

describe("updateExpenditure with an eligible measurement", () => {
  it("should add one process step of 75 squared to the variance before the gain, and only once", () => {
    // P = 140 625 + 5 625 = 146 250, so with R of 62 467.9 the gain is 146 250 / 208 717.9.
    const update = updateExpenditure(PRIOR, measurementOf(2585, 62467.9));

    expectWithin(update.gain, 0.7007066, 1e-6);
  });

  it("should move the mean by the gain times the gap and shrink the variance to (1 - gain) times P", () => {
    const update = updateExpenditure(PRIOR, measurementOf(2585, 62467.9));

    expectWithin(update.rawStepKcal, 59.560057, 1e-4);
    expect(update.stepKcal).toBe(update.rawStepKcal);
    expectWithin(update.muKcal, 2559.560057, 1e-4);
    expectWithin(update.varKcal2, 43771.6668, 1e-3);
    expect(update.stepClamped).toBe(false);
  });

  it("should step down as well as up", () => {
    const update = updateExpenditure(PRIOR, measurementOf(2415, 62467.9));

    expectWithin(update.rawStepKcal, -59.560057, 1e-4);
    expectWithin(update.muKcal, 2440.439943, 1e-4);
  });

  it("should settle a mean that is already at z with a step of 0 and still shrink the variance", () => {
    const update = updateExpenditure(PRIOR, measurementOf(2500, 62467.9));

    expect(update.muKcal).toBe(2500);
    expect(update.rawStepKcal).toBe(0);
    expect(update.stepClamped).toBe(false);
    expectWithin(update.varKcal2, 43771.6668, 1e-3);
  });

  it("should give a gain of about 0.7 for the first measurement after the prior of a male of 35, 80 kg, 180 cm and light activity", () => {
    // BMR 1755, mu 2413.125, var (0.15 * 2413.125)^2 = 131 021.376, R of 62 467.9.
    const update = updateExpenditure(
      { muKcal: 2413.125, varKcal2: 131021.376 },
      measurementOf(2585, 62467.9),
    );

    expectWithin(update.gain, 0.7, 0.05);
    expectWithin(update.gain, 0.686271, 1e-6);
  });
});

describe("updateExpenditure weekly clamp of 250 kcal", () => {
  it("should limit a rise of 999.99 kcal to 250 and say it clamped", () => {
    const update = updateExpenditure({ muKcal: 2000, varKcal2: 140625 }, measurementOf(3000, 1));

    expectWithin(update.rawStepKcal, 999.993162, 1e-5);
    expect(update.stepKcal).toBe(250);
    expect(update.stepClamped).toBe(true);
    expect(update.muKcal).toBe(2250);
  });

  it("should take the variance from the unclamped gain, so 0.99999316 and not 109 687.5", () => {
    const update = updateExpenditure({ muKcal: 2000, varKcal2: 140625 }, measurementOf(3000, 1));

    expectWithin(update.gain, 0.999993162, 1e-8);
    expectWithin(update.varKcal2, 0.99999316, 1e-6);
  });

  it("should limit a fall to -250", () => {
    const update = updateExpenditure({ muKcal: 3000, varKcal2: 140625 }, measurementOf(2000, 1));

    expectWithin(update.rawStepKcal, -999.993162, 1e-5);
    expect(update.stepKcal).toBe(-250);
    expect(update.stepClamped).toBe(true);
    expect(update.muKcal).toBe(2750);
  });

  it("should not call a raw step of exactly 250 clamped", () => {
    // P is 4 375 + 5 625 = 10 000 and R is 10 000, so the gain is exactly a half and 500 kcal away gives 250.
    const update = updateExpenditure({ muKcal: 2000, varKcal2: 4375 }, measurementOf(2500, 10000));

    expect(update.gain).toBe(0.5);
    expect(update.rawStepKcal).toBe(250);
    expect(update.stepKcal).toBe(250);
    expect(update.stepClamped).toBe(false);
  });

  it("should say the clamp is 250 kcal a week", () => {
    expect(DEFAULT_ENGINE_PARAMS.expenditure.maxWeeklyChangeKcal).toBe(250);
  });
});

describe("updateExpenditure keeps the mean inside the expenditure range", () => {
  it("should pull a prior below 800 up to 800 when z is 800", () => {
    // P = 1000 + 5625, gain = 6625 / 7625, so the mean would reach 786.9 without the clamp.
    const update = updateExpenditure({ muKcal: 700, varKcal2: 1000 }, measurementOf(800, 1000));

    expect(update.muKcal).toBe(800);
  });

  it("should pull a prior above 6000 down to 6000 when z is 6000", () => {
    const update = updateExpenditure({ muKcal: 6100, varKcal2: 1000 }, measurementOf(6000, 1000));

    expect(update.muKcal).toBe(6000);
  });

  it("should leave a mean inside the range alone", () => {
    const update = updateExpenditure({ muKcal: 800, varKcal2: 1000 }, measurementOf(800, 1000));

    expect(update.muKcal).toBe(800);
  });
});

describe("updateExpenditure without a measurement", () => {
  it("should leave the mean and add one process step of 5 625 to the variance", () => {
    const update = updateExpenditure(PRIOR, INELIGIBLE);

    expect(update).toStrictEqual({ muKcal: 2500, varKcal2: 146250 });
  });

  it("should add 16 875 over three ineligible check-ins in a row", () => {
    let belief: ExpenditureBelief = PRIOR;

    for (let checkIn = 0; checkIn < 3; checkIn += 1) {
      belief = updateExpenditure(belief, INELIGIBLE);
    }

    expect(belief).toStrictEqual({ muKcal: 2500, varKcal2: 157500 });
  });

  it("should treat a null measurement as an ineligible one", () => {
    expect(updateExpenditure(PRIOR, null)).toStrictEqual({ muKcal: 2500, varKcal2: 146250 });
  });

  it("should carry no gain or step fields, as the ADR says", () => {
    const update = updateExpenditure(PRIOR, INELIGIBLE);

    expect(Object.keys(update).sort()).toStrictEqual(["muKcal", "varKcal2"]);
  });

  it("should not clamp the mean of a belief that only drifts", () => {
    expect(updateExpenditure({ muKcal: 700, varKcal2: 1000 }, INELIGIBLE).muKcal).toBe(700);
  });
});

describe("updateExpenditure result of an eligible measurement", () => {
  it("should hold exactly the new belief and the four step fields", () => {
    const update = updateExpenditure(PRIOR, measurementOf(2585, 62467.9));

    expect(Object.keys(update).sort()).toStrictEqual([
      "gain",
      "muKcal",
      "rawStepKcal",
      "stepClamped",
      "stepKcal",
      "varKcal2",
    ]);
  });

  it("should not change the prior it is given", () => {
    const prior: ExpenditureBelief = { muKcal: 2500, varKcal2: 140625 };

    updateExpenditure(prior, measurementOf(2585, 62467.9));

    expect(prior).toStrictEqual({ muKcal: 2500, varKcal2: 140625 });
  });
});

describe("updateExpenditure result types", () => {
  it("should type an eligible measurement's result as an ExpenditureUpdate", () => {
    const update: ExpenditureUpdate = updateExpenditure(PRIOR, measurementOf(2585, 62467.9));

    expect(update.stepClamped).toBe(false);
  });

  it("should type an ineligible measurement's result as a belief with no gain", () => {
    const belief: ExpenditureBelief = updateExpenditure(PRIOR, INELIGIBLE);

    // @ts-expect-error An ineligible result carries no gain.
    expect(belief.gain).toBeUndefined();
  });

  it("should type a null measurement's result as a belief with no step fields", () => {
    const belief = updateExpenditure(PRIOR, null);

    // @ts-expect-error A result without a measurement carries no step fields.
    expect(belief.stepKcal).toBeUndefined();
  });
});

describe("updateExpenditure params", () => {
  it("should read the process noise and the clamp from the params it is given", () => {
    const params: EngineParams = {
      ...DEFAULT_ENGINE_PARAMS,
      expenditure: {
        ...DEFAULT_ENGINE_PARAMS.expenditure,
        processSdKcalPerWeek: 100,
        maxWeeklyChangeKcal: 50,
      },
    };

    // P = 140 625 + 10 000, gain 0.706851, raw step 60.0824, so 50 clamped, var from the unclamped gain.
    const update = updateExpenditure(PRIOR, measurementOf(2585, 62467.9), params);

    expectWithin(update.gain, 0.706851, 1e-6);
    expectWithin(update.rawStepKcal, 60.08236, 1e-4);
    expect(update.stepKcal).toBe(50);
    expect(update.stepClamped).toBe(true);
    expect(update.muKcal).toBe(2550);
    expectWithin(update.varKcal2, 44155.5183, 1e-3);
  });

  it("should read the process noise from the params when there is no measurement", () => {
    const params: EngineParams = {
      ...DEFAULT_ENGINE_PARAMS,
      expenditure: { ...DEFAULT_ENGINE_PARAMS.expenditure, processSdKcalPerWeek: 100 },
    };

    expect(updateExpenditure(PRIOR, null, params).varKcal2).toBe(150625);
  });

  it("should use a process noise of 75 kcal a week by default", () => {
    expect(DEFAULT_ENGINE_PARAMS.expenditure.processSdKcalPerWeek).toBe(75);
  });
});

describe("updateExpenditure steady state", () => {
  it("should settle at a gain of about 0.28 over 30 identical weekly measurements", () => {
    // R of 50 000 is a typical full window. The fixed point of the recursion is P 19 817.21, gain 0.283844
    // and variance 14 192.21, and week 1 is 0.745223.
    let belief: ExpenditureBelief = PRIOR;
    const gains: number[] = [];

    for (let week = 0; week < 30; week += 1) {
      const update = updateExpenditure(belief, measurementOf(2585, 50000));
      gains.push(update.gain);
      belief = update;
    }

    expectWithin(gains[0] ?? Number.NaN, 0.745223, 1e-6);
    expectWithin(gains[29] ?? Number.NaN, 0.283844, 1e-5);
    expectWithin(belief.varKcal2, 14192.21, 0.01);
  });

  it("should never raise the gain from one identical week to the next", () => {
    let belief: ExpenditureBelief = PRIOR;
    let previousGain = Number.POSITIVE_INFINITY;

    for (let week = 0; week < 30; week += 1) {
      const update = updateExpenditure(belief, measurementOf(2585, 50000));
      expect(update.gain).toBeLessThanOrEqual(previousGain);
      previousGain = update.gain;
      belief = update;
    }
  });
});

describe("updateExpenditure properties", () => {
  const EXPENDITURE_KCAL = fc.double({ min: 800, max: 6000, noNaN: true });
  const VARIANCE_KCAL2 = fc.double({ min: 1, max: 1_000_000, noNaN: true });
  const prior = fc.record({ muKcal: EXPENDITURE_KCAL, varKcal2: VARIANCE_KCAL2 });
  const measurement = fc
    .record({ zKcal: EXPENDITURE_KCAL, rKcal2: VARIANCE_KCAL2 })
    .map(({ zKcal, rKcal2 }) => measurementOf(zKcal, rKcal2));

  const processVariance = 75 ** 2;

  it("should leave a variance below P whenever there is a measurement", () => {
    fc.assert(
      fc.property(prior, measurement, (belief, eligible) => {
        const update = updateExpenditure(belief, eligible);

        expect(update.varKcal2).toBeLessThan(belief.varKcal2 + processVariance);
        expect(update.varKcal2).toBeGreaterThan(0);
      }),
    );
  });

  it("should move the mean by at most 250 kcal", () => {
    fc.assert(
      fc.property(prior, measurement, (belief, eligible) => {
        const update = updateExpenditure(belief, eligible);

        expect(Math.abs(update.muKcal - belief.muKcal)).toBeLessThanOrEqual(250 + 1e-9);
      }),
    );
  });

  it("should leave the mean between the prior mean and z", () => {
    fc.assert(
      fc.property(prior, measurement, (belief, eligible) => {
        const update = updateExpenditure(belief, eligible);
        const lowest = Math.min(belief.muKcal, eligible.zKcal);
        const highest = Math.max(belief.muKcal, eligible.zKcal);

        expect(update.muKcal).toBeGreaterThanOrEqual(lowest - 1e-9);
        expect(update.muKcal).toBeLessThanOrEqual(highest + 1e-9);
      }),
    );
  });

  it("should keep the mean inside 800 to 6000", () => {
    fc.assert(
      fc.property(prior, measurement, (belief, eligible) => {
        const update = updateExpenditure(belief, eligible);

        expect(update.muKcal).toBeGreaterThanOrEqual(800);
        expect(update.muKcal).toBeLessThanOrEqual(6000);
      }),
    );
  });

  it("should leave the mean and grow the variance by exactly one process step without a measurement", () => {
    fc.assert(
      fc.property(prior, (belief) => {
        const update = updateExpenditure(belief, null);

        expect(update.muKcal).toBe(belief.muKcal);
        expectWithin(update.varKcal2, belief.varKcal2 + processVariance, 1e-6);
      }),
    );
  });
});
