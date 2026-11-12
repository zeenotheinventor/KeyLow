import { describe, expect, it } from "vitest";

import {
  ESTIMATE_HISTORY_WEEKS,
  fallbackWeightKgOf,
  isProgrammeKnown,
  isWaitingForProgramme,
  measuredEstimateOf,
  startingPlan,
} from "../../src/setup";

import type { EstimateSnapshot, MeasuredEstimateInput, SetupAnswers } from "../../src/setup";

/*
 * Every expected figure is a literal. The golden person is the program canvas's: after the third check-in
 * on Friday 23 October the expenditure is mu 2,579.54 and the trend weight on the day before is 79.0227 kg,
 * so a change of the rate to 0.25% gives 2,360 kcal, P 126, F 82, C 280. The canvas draws C 278 from
 * protein and fat before they are rounded, and the engine rounds them first, so the engine's 280 is the
 * figure the save writes. The screen decides settling the way the server's recompute does: from the user's
 * newest snapshot, of any programme, by core's `startSnapshotAction`.
 */

const today = "2026-10-23";

const answers: SetupAnswers = {
  sex: "male",
  birthDate: "1991-03-14",
  heightCm: 180,
  weightKg: 80,
  weightUnit: "kg",
  heightUnit: "cm",
  activity: "light",
  goal: "lose",
  ratePctPerWeek: 0.25,
  proteinPreset: "moderate",
  dietStyle: "balanced",
};

function startSnapshot(asOfDate: string, muKcal: number): EstimateSnapshot {
  return { kind: "start", asOfDate, muKcal, measurement: null };
}

function measuredSnapshot(asOfDate: string, muKcal: number): EstimateSnapshot {
  return { kind: "checkin", asOfDate, muKcal, measurement: { eligible: true } };
}

function unmeasuredSnapshot(asOfDate: string, muKcal: number): EstimateSnapshot {
  return { kind: "checkin", asOfDate, muKcal, measurement: { eligible: false } };
}

const goldenTrend = [
  { date: "2026-10-21", trendKg: 79.07 },
  { date: "2026-10-22", trendKg: 79.0227 },
];

const goldenHistory = [
  startSnapshot("2026-09-25", 2500),
  measuredSnapshot("2026-10-09", 2559.56),
  measuredSnapshot("2026-10-16", 2574.22),
  measuredSnapshot("2026-10-23", 2579.54),
];

function input(overrides: Partial<MeasuredEstimateInput> = {}): MeasuredEstimateInput {
  return {
    answers,
    plan: startingPlan(answers, today, null),
    today,
    history: goldenHistory,
    trendPoints: goldenTrend,
    fallbackWeightKg: 80,
    ...overrides,
  };
}

function inputFor(
  changed: Partial<SetupAnswers>,
  overrides: Partial<MeasuredEstimateInput> = {},
): MeasuredEstimateInput {
  const changedAnswers = { ...answers, ...changed };
  return input({
    answers: changedAnswers,
    plan: startingPlan(changedAnswers, today, null),
    ...overrides,
  });
}

describe("measuredEstimateOf", () => {
  describe("when the recompute would start again from the answers", () => {
    it("should keep the estimate of the answers when there is no snapshot", () => {
      expect(measuredEstimateOf(input({ history: [] }))).toBeUndefined();
    });

    it("should keep the estimate of the answers when the newest snapshot is the start snapshot", () => {
      expect(
        measuredEstimateOf(input({ history: [startSnapshot("2026-10-20", 2413.125)] })),
      ).toBeUndefined();
    });

    it("should keep the estimate of the answers when a new start snapshot is newer than the last check-in", () => {
      expect(
        measuredEstimateOf(
          input({
            history: [
              measuredSnapshot("2026-10-16", 2579.54),
              startSnapshot("2026-10-22", 2413.125),
            ],
          }),
        ),
      ).toBeUndefined();
    });

    it("should keep the estimate of the answers when the newest check-in is 35 days old", () => {
      expect(
        measuredEstimateOf(input({ history: [measuredSnapshot("2026-09-18", 2579.54)] })),
      ).toBeUndefined();
    });

    it("should keep the estimate of the answers when the newest check-in is 29 days old", () => {
      expect(
        measuredEstimateOf(input({ history: [measuredSnapshot("2026-09-24", 2579.54)] })),
      ).toBeUndefined();
    });

    it("should keep the measured expenditure when the newest check-in is exactly 28 days old", () => {
      expect(
        measuredEstimateOf(input({ history: [measuredSnapshot("2026-09-25", 2579.54)] }))?.plan
          .estimate.expenditureKcal,
      ).toBe(2579.54);
    });
  });

  describe("after a check-in that measured", () => {
    it("should keep the measured expenditure of 2,579.54 kcal whatever the answers say", () => {
      expect(measuredEstimateOf(input())?.plan.estimate.expenditureKcal).toBe(2579.54);
    });

    it("should give 2,360 kcal, P 126, F 82 and C 280 for the golden person at 0.25%", () => {
      expect(measuredEstimateOf(input())?.plan.targets).toEqual({
        caloriesKcal: 2360,
        proteinG: 126,
        fatG: 82,
        carbsG: 280,
      });
    });

    it("should say it was measured on the date of that check-in", () => {
      expect(measuredEstimateOf(input())?.measurement).toEqual({
        kind: "measured",
        measuredOn: "2026-10-23",
      });
    });

    it("should read the rate line's weight from the trend weight on yesterday, 79.0227 kg", () => {
      expect(measuredEstimateOf(input())?.answers.weightKg).toBe(79.0227);
    });

    it("should leave everything the save writes as the answers made it", () => {
      const result = measuredEstimateOf(input());

      expect(result?.plan.save.profile.onboarding_weight_kg).toBe(80);
      expect(result?.plan.save.program.rate_pct_per_week).toBe(0.25);
      expect(result?.plan.save.weighIn).toEqual({ weightKg: 80, localDate: "2026-10-23" });
    });

    it("should record no clamp for the golden person", () => {
      expect(measuredEstimateOf(input())?.plan.clamps).toEqual([]);
    });

    it("should state the effective rate as 0.25% of the trend weight, to two decimals", () => {
      expect(measuredEstimateOf(input())?.plan.effectiveRatePctPerWeek).toBeCloseTo(0.25, 2);
    });

    it("should give 2,140 kcal at the saved rate of 0.5%, as the server writes for a check-in 10 days old", () => {
      const result = measuredEstimateOf(
        inputFor({ ratePctPerWeek: 0.5 }, { history: [measuredSnapshot("2026-10-13", 2579.54)] }),
      );

      expect(result?.plan.targets.caloriesKcal).toBe(2140);
      expect(result?.measurement).toEqual({ kind: "measured", measuredOn: "2026-10-13" });
    });

    it("should take the mean of the newest snapshot, whichever order the history comes in", () => {
      const result = measuredEstimateOf(
        input({
          history: [
            measuredSnapshot("2026-10-22", 2400),
            measuredSnapshot("2026-10-15", 2579.54),
            startSnapshot("2026-10-01", 2500),
          ],
        }),
      );

      expect(result?.plan.estimate.expenditureKcal).toBe(2400);
      expect(result?.plan.targets.caloriesKcal).toBe(2180);
    });

    it("should date the measurement by the newest check-in that measured, not the newest check-in", () => {
      const result = measuredEstimateOf(
        input({
          history: [
            measuredSnapshot("2026-10-09", 2559.56),
            measuredSnapshot("2026-10-16", 2574.22),
            unmeasuredSnapshot("2026-10-22", 2574.22),
          ],
        }),
      );

      expect(result?.measurement).toEqual({ kind: "measured", measuredOn: "2026-10-16" });
    });

    it("should keep a snapshot of an ended programme: the recompute keeps the newest snapshot of any programme", () => {
      const result = measuredEstimateOf(
        input({ history: [measuredSnapshot("2026-10-13", 2579.54)] }),
      );

      expect(result?.plan.estimate.expenditureKcal).toBe(2579.54);
    });
  });

  describe("when the floor sets the calories", () => {
    // mu 1,700 at 1.0%: the 30% bound is 1,190 and the floor is 0.9 x BMR 1,755 = 1,579.5, so 1,580 and both clamps.
    const floorInput = () =>
      inputFor({ ratePctPerWeek: 1 }, { history: [measuredSnapshot("2026-10-22", 1700)] });

    it("should give 1,580 kcal with the deficit cap and the floor recorded", () => {
      const result = measuredEstimateOf(floorInput());

      expect(result?.plan.targets.caloriesKcal).toBe(1580);
      expect(result?.plan.clamps).toEqual(["max_deficit", "floor"]);
    });

    it("should state the effective rate of the raised target, 0.138% of the trend weight", () => {
      // (1,700 - 1,580) x 7 / 7,700 = 0.109 kg a week, 0.138% of 79.0227 kg.
      expect(measuredEstimateOf(floorInput())?.plan.effectiveRatePctPerWeek).toBeCloseTo(0.138, 3);
    });

    it("should work the floor from the BMR of the answers' stats on today, 1,755 kcal", () => {
      expect(measuredEstimateOf(floorInput())?.plan.estimate.bmrKcal).toBe(1755);
    });
  });

  describe("after check-ins that never measured", () => {
    it("should carry the expenditure forward from the newest check-in", () => {
      const result = measuredEstimateOf(
        input({
          history: [startSnapshot("2026-10-09", 2400), unmeasuredSnapshot("2026-10-22", 2413.125)],
        }),
      );

      expect(result?.measurement).toEqual({ kind: "carried-forward" });
      expect(result?.plan.estimate.expenditureKcal).toBe(2413.125);
    });

    it("should be worked out from that expenditure and not from the answers' own estimate (2,413)", () => {
      const result = measuredEstimateOf(
        input({ history: [unmeasuredSnapshot("2026-10-22", 2500)] }),
      );

      // 2,500 - 0.0025 x 79.0227 x 1,100 = 2,282.7, so 2,280 kcal. The answers' own estimate would give 2,190.
      expect(result?.plan.targets.caloriesKcal).toBe(2280);
    });
  });

  describe("the trend weight", () => {
    it("should be the newest point on or before yesterday, never one of today", () => {
      const result = measuredEstimateOf(
        input({ trendPoints: [...goldenTrend, { date: "2026-10-23", trendKg: 60 }] }),
      );

      expect(result?.answers.weightKg).toBe(79.0227);
    });

    it("should be the fallback weight when no point is on or before yesterday", () => {
      const result = measuredEstimateOf(
        input({ trendPoints: [{ date: "2026-10-23", trendKg: 60 }], fallbackWeightKg: 78 }),
      );

      expect(result?.answers.weightKg).toBe(78);
    });
  });
});

describe("the reads a recalculation keeps the measured expenditure from", () => {
  it("should read a year of weekly check-ins", () => {
    expect(ESTIMATE_HISTORY_WEEKS).toBe(52);
  });

  it("should wait while the history is pending or the trend is loading, in a recalculation only", () => {
    expect(
      isWaitingForProgramme({
        isRecalculating: true,
        isHistoryPending: true,
        isTrendLoading: false,
      }),
    ).toBe(true);
    expect(
      isWaitingForProgramme({
        isRecalculating: true,
        isHistoryPending: false,
        isTrendLoading: true,
      }),
    ).toBe(true);
    expect(
      isWaitingForProgramme({
        isRecalculating: true,
        isHistoryPending: false,
        isTrendLoading: false,
      }),
    ).toBe(false);
    expect(
      isWaitingForProgramme({
        isRecalculating: false,
        isHistoryPending: true,
        isTrendLoading: true,
      }),
    ).toBe(false);
  });

  it.each([
    ["history in hand, trend settled", [], false, false, true],
    ["history missing", undefined, false, false, false],
    ["trend loading", [], true, false, false],
    ["trend failed", [], false, true, false],
  ])("should know the programme when %s: %s", (_case, history, isLoading, isError, expected) => {
    expect(isProgrammeKnown(history, { isLoading, isError })).toBe(expected);
  });

  it("should fall back to the latest weigh-in's weight, and to the answers' own when there is none", () => {
    expect(fallbackWeightKgOf(79.5, answers)).toBe(79.5);
    expect(fallbackWeightKgOf(null, answers)).toBe(80);
    expect(fallbackWeightKgOf(undefined, answers)).toBe(80);
  });
});
