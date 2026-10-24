import { describe, expect, it } from "vitest";

import { beliefOf, DAY_ZERO, runCheckin, snapshotOf, startTargets, targetsOf } from "./checkinRows";
import { CLAMPS } from "../../src/engine";
import { checkinSummary } from "../../src/program";
import { goldenCheckinFixture, ineligibleCheckinFixture } from "../../src/testing";

import type { CheckinSummary, ProgramSnapshot, ProgramTargets } from "../../src/program";

/*
 * Every expected figure is a literal: the golden chain is the table of ADR 0002, Amendment 2, and the
 * start targets (2060) and the other checks come from the arithmetic on the programme canvas
 * (docs/canvas/program, "checkin-summary" notes), worked out by hand.
 */

const GOLDEN = goldenCheckinFixture(DAY_ZERO);
const INELIGIBLE = ineligibleCheckinFixture(DAY_ZERO);

function expectWithin(actual: number, expected: number, tolerance: number): void {
  expect(actual).toBeGreaterThanOrEqual(expected - tolerance);
  expect(actual).toBeLessThanOrEqual(expected + tolerance);
}

function goldenChain() {
  const first = runCheckin(GOLDEN, 14);
  const second = runCheckin(GOLDEN, 21, { prior: beliefOf(first) });
  const third = runCheckin(GOLDEN, 28, { prior: beliefOf(second) });
  return { first, second, third };
}

describe("checkinSummary of a check-in that measured", () => {
  it("should read the golden day 14 check-in as measured, a step of +59.56 that was not clamped", () => {
    const first = runCheckin(GOLDEN, 14);

    const summary = checkinSummary(startTargets(first), targetsOf(first), snapshotOf(first));

    expect(summary.kind).toBe("measured");
    expect(summary.reasons).toEqual([]);
    expect(summary.counts).toEqual({ spanDays: 14, weighDays: 14, completeDays: 14 });
    expectWithin(summary.expenditureChangeKcal, 59.56, 0.01);
    expect(summary.expenditureStepClamped).toBe(false);
    expect(summary.varianceGrew).toBe(false);
  });

  it("should give the calories change from the start targets, 2060 to 2120", () => {
    const first = runCheckin(GOLDEN, 14);

    const summary = checkinSummary(startTargets(first), targetsOf(first), snapshotOf(first));

    expect(targetsOf(first).caloriesKcal).toBe(2120);
    expect(summary.caloriesChangeKcal).toBe(60);
  });

  it("should give no change when the calories stay at 2140 between the second and third check-in", () => {
    const { second, third } = goldenChain();

    const summary = checkinSummary(targetsOf(second), targetsOf(third), snapshotOf(third));

    expect(summary.caloriesChangeKcal).toBe(0);
    expect(targetsOf(third).caloriesKcal).toBe(2140);
  });

  it("should give a negative change when the calories fall", () => {
    const first = runCheckin(GOLDEN, 14);
    const higherBefore = { ...startTargets(first), caloriesKcal: 2200 };

    const summary = checkinSummary(higherBefore, targetsOf(first), snapshotOf(first));

    expect(summary.caloriesChangeKcal).toBe(-80);
  });

  it("should give a null calories change when there are no earlier targets", () => {
    const first = runCheckin(GOLDEN, 14);

    const summary = checkinSummary(null, targetsOf(first), snapshotOf(first));

    expect(summary.caloriesChangeKcal).toBeNull();
  });

  it("should pass the effective rate through, 0.502 % of the trend weight a week, not below the goal", () => {
    const first = runCheckin(GOLDEN, 14);

    const summary = checkinSummary(startTargets(first), targetsOf(first), snapshotOf(first));

    // (2559.56 - 2120) / (79.592 kg * 7700 / 7 / 100) = 439.56 / 875.51
    expect(summary.effectiveRatePctPerWeek).toBeCloseTo(0.502, 2);
    expect(summary.belowGoalDirection).toBe(false);
    expect(summary.clamps).toEqual([]);
  });

  it("should mark a step that the weekly clamp cut, with the step actually taken", () => {
    // Prior 3500 against a measurement of 2585: K 0.70071 asks for -641, the clamp holds it to -250.
    const clamped = runCheckin(GOLDEN, 14, { prior: { muKcal: 3500, varKcal2: 140625 } });

    const summary = checkinSummary(startTargets(clamped), targetsOf(clamped), snapshotOf(clamped));

    expect(summary.kind).toBe("measured");
    expect(summary.expenditureStepClamped).toBe(true);
    expect(summary.expenditureChangeKcal).toBe(-250);
  });
});

describe("checkinSummary of how the variance and the raw step moved", () => {
  it("should say the variance did not grow for a normal measured week (140625 down to 43771.7)", () => {
    const first = runCheckin(GOLDEN, 14);

    const summary = checkinSummary(startTargets(first), targetsOf(first), snapshotOf(first));

    expect(summary.varianceGrew).toBe(false);
  });

  it("should say the variance grew for a measured week whose R_eff is so large that it hardly helped", () => {
    // Prior 2580 / 13449, so P = 13449 + 75^2 = 19074. R_eff 145000 gives K = 19074 / 164074 = 0.11625
    // and var' = (1 - K) * P = 16856.6, which is above the prior 13449 although the week measured.
    const hardlyHelped: ProgramSnapshot = {
      kind: "checkin",
      asOfDate: "2026-04-16",
      muKcal: 2575,
      varKcal2: 16856.6,
      measurement: {
        eligible: true,
        zKcal: 2500,
        rKcal2: 145000,
        slopeKgPerDay: 0,
        seSlopeKg: 0.3,
        meanIntakeKcal: 2500,
        spanDays: 28,
        weighDays: 28,
        completeDays: 28,
        gain: 0.11625,
        rawStepKcal: -5,
        stepKcal: -5,
        stepClamped: false,
      },
    };
    const first = runCheckin(GOLDEN, 14);

    const summary = checkinSummary(startTargets(first), targetsOf(first), hardlyHelped);

    expect(summary.kind).toBe("measured");
    expect(summary.varianceGrew).toBe(true);
  });

  it("should give the raw step for a measured week, +59.56 when it was not clamped", () => {
    const first = runCheckin(GOLDEN, 14);

    const summary = checkinSummary(startTargets(first), targetsOf(first), snapshotOf(first));

    expectWithin(summary.expenditureRawChangeKcal, 59.56, 0.01);
  });

  it("should give the raw step the clamp cut, about -641 beside the -250 taken", () => {
    // K 0.70071 * (2585 - 3500) = -641.15
    const clamped = runCheckin(GOLDEN, 14, { prior: { muKcal: 3500, varKcal2: 140625 } });

    const summary = checkinSummary(startTargets(clamped), targetsOf(clamped), snapshotOf(clamped));

    expectWithin(summary.expenditureRawChangeKcal, -641.15, 0.1);
    expect(summary.expenditureChangeKcal).toBe(-250);
  });

  it("should give a raw step of 0 when the week did not measure", () => {
    const week = runCheckin(INELIGIBLE, 14);

    const summary = checkinSummary(startTargets(week), targetsOf(week), snapshotOf(week));

    expect(summary.expenditureRawChangeKcal).toBe(0);
  });
});

describe("checkinSummary of a check-in that could not measure", () => {
  it("should read the 9 complete days fixture as not measured, for complete days alone, and the variance grew", () => {
    const week = runCheckin(INELIGIBLE, 14);

    const summary = checkinSummary(startTargets(week), targetsOf(week), snapshotOf(week));

    expect(summary.kind).toBe("not_measured");
    expect(summary.reasons).toEqual(["complete_days"]);
    expect(summary.counts).toEqual({ spanDays: 14, weighDays: 14, completeDays: 9 });
    expect(summary.varianceGrew).toBe(true);
  });

  it("should carry the expenditure forward and keep the calories at 2060", () => {
    const week = runCheckin(INELIGIBLE, 14);

    const summary = checkinSummary(startTargets(week), targetsOf(week), snapshotOf(week));

    expect(snapshotOf(week).muKcal).toBe(2500);
    expect(summary.expenditureChangeKcal).toBe(0);
    expect(summary.expenditureStepClamped).toBe(false);
    expect(targetsOf(week).caloriesKcal).toBe(2060);
    expect(summary.caloriesChangeKcal).toBe(0);
  });

  it("should list the span and weigh-in reasons, in that order, for weigh-ins on 5 days only", () => {
    // Weigh-ins on days 5, 6, 8, 11 and 13 cover 9 days (13 - 5 + 1) and are 5 days: the canvas's right-hand case.
    const sparse = runCheckin(GOLDEN, 14, { weighInDays: [5, 6, 8, 11, 13] });

    const summary = checkinSummary(startTargets(sparse), targetsOf(sparse), snapshotOf(sparse));

    expect(summary.reasons).toEqual(["span", "weigh_days"]);
    expect(summary.counts).toEqual({ spanDays: 9, weighDays: 5, completeDays: 14 });
  });

  it("should list all three reasons, in order, when the window fails every rule", () => {
    const thin = runCheckin(INELIGIBLE, 14, { weighInDays: [5, 6, 8, 11, 13] });

    const summary = checkinSummary(startTargets(thin), targetsOf(thin), snapshotOf(thin));

    expect(summary.reasons).toEqual(["span", "weigh_days", "complete_days"]);
    expect(summary.counts).toEqual({ spanDays: 9, weighDays: 5, completeDays: 9 });
  });
});

describe("checkinSummary of the start estimate and of a recompute", () => {
  const startSnapshot: ProgramSnapshot = {
    kind: "start",
    asOfDate: "2026-10-23",
    muKcal: 2500,
    varKcal2: 140625,
    measurement: null,
  };

  it("should read a start snapshot as start, with nothing measured and no earlier calories", () => {
    const first = runCheckin(GOLDEN, 14);

    const summary = checkinSummary(null, startTargets(first), startSnapshot);

    expect(summary).toMatchObject({
      kind: "start",
      reasons: [],
      counts: { spanDays: 0, weighDays: 0, completeDays: 0 },
      expenditureChangeKcal: 0,
      expenditureStepClamped: false,
      varianceGrew: false,
      caloriesChangeKcal: null,
    });
  });

  it("should read a recompute while settling as recompute, not start", () => {
    const first = runCheckin(GOLDEN, 14);
    const recomputed: ProgramTargets = {
      caloriesKcal: 2100,
      basis: { ...targetsOf(first).basis, source: "recompute" },
    };

    const summary = checkinSummary(startTargets(first), recomputed, startSnapshot);

    expect(summary.kind).toBe("recompute");
    expect(summary.caloriesChangeKcal).toBe(40);
  });

  it("should read a recompute as recompute and not describe the last check-in's measurement", () => {
    const week = runCheckin(INELIGIBLE, 14);
    const recomputed: ProgramTargets = {
      caloriesKcal: 2100,
      basis: { ...targetsOf(week).basis, source: "recompute" },
    };

    const summary = checkinSummary(targetsOf(week), recomputed, snapshotOf(week));

    expect(summary).toMatchObject({
      kind: "recompute",
      reasons: [],
      counts: { spanDays: 0, weighDays: 0, completeDays: 0 },
      expenditureChangeKcal: 0,
      expenditureStepClamped: false,
      varianceGrew: false,
      caloriesChangeKcal: 40,
    });
  });
});

describe("checkinSummary of a target a guardrail bound", () => {
  it("should record the floor when it lifts the target, and stay in the goal's direction below expenditure", () => {
    // BMR 2400 makes the floor 2160, above the 2060 the rate asks for and below mu.
    const floored = runCheckin(INELIGIBLE, 14, { bmrKcal: 2400 });

    const summary = checkinSummary(startTargets(floored), targetsOf(floored), snapshotOf(floored));

    expect(summary.clamps).toContain("floor");
    expect(targetsOf(floored).caloriesKcal).toBe(2160);
    expect(summary.effectiveRatePctPerWeek).toBeGreaterThan(0);
    expect(summary.belowGoalDirection).toBe(false);
  });

  it("should flag the goal's direction when the floor is above expenditure, with a negative rate", () => {
    // BMR 3000 makes the floor 2700, above mu 2500: a lose target that gains. (2500 - 2700) / 875.51 kg.
    const floored = runCheckin(INELIGIBLE, 14, { bmrKcal: 3000 });

    const summary = checkinSummary(startTargets(floored), targetsOf(floored), snapshotOf(floored));

    expect(summary.clamps).toContain("floor");
    expect(targetsOf(floored).caloriesKcal).toBe(2700);
    expect(summary.effectiveRatePctPerWeek).toBeCloseTo(-0.2284, 3);
    expect(summary.belowGoalDirection).toBe(true);
  });

  it("should not flag the goal's direction for a maintain goal, whose rate is 0", () => {
    const maintaining = runCheckin(INELIGIBLE, 14, { program: { goal: "maintain" } });

    const summary = checkinSummary(
      startTargets(maintaining),
      targetsOf(maintaining),
      snapshotOf(maintaining),
    );

    expect(summary.effectiveRatePctPerWeek).toBe(0);
    expect(summary.belowGoalDirection).toBe(false);
  });

  it("should record profile_max when a gain is capped at 6000", () => {
    // mu 5600 and a gain of 0.5 %: 5600 + 437.8 is 6040 once rounded, and the profile range stops at 6000.
    const capped = runCheckin(INELIGIBLE, 14, {
      prior: { muKcal: 5600, varKcal2: 140625 },
      program: { goal: "gain" },
    });

    const summary = checkinSummary(startTargets(capped), targetsOf(capped), snapshotOf(capped));

    expect(targetsOf(capped).caloriesKcal).toBe(6000);
    expect(summary.clamps).toContain("profile_max");
  });

  it("should keep the clamps in the order they were recorded", () => {
    const first = runCheckin(GOLDEN, 14);
    const targets = targetsOf(first);
    const recorded: ProgramTargets = {
      ...targets,
      basis: { ...targets.basis, clamps: ["max_deficit", "floor", "macro_fit", "profile_max"] },
    };

    const summary = checkinSummary(null, recorded, snapshotOf(first));

    expect(summary.clamps).toEqual(["max_deficit", "floor", "macro_fit", "profile_max"]);
  });

  it("should drop a clamp code this build does not know, so only codes of the closed list reach a screen", () => {
    const first = runCheckin(GOLDEN, 14);
    const targets = targetsOf(first);
    const recorded: ProgramTargets = {
      ...targets,
      basis: { ...targets.basis, clamps: ["floor", "a_newer_guardrail"] },
    };

    const summary = checkinSummary(null, recorded, snapshotOf(first));

    expect(summary.clamps).toEqual(["floor"]);
  });
});

describe("checkinSummary holds codes and numbers only", () => {
  const KINDS = ["measured", "not_measured", "start", "recompute"];
  const REASONS = ["span", "weigh_days", "complete_days"];
  const CLAMP_CODES: readonly string[] = [...CLAMPS, "profile_max"];

  function expectNoWords(summary: CheckinSummary): void {
    expect(Object.keys(summary).sort()).toEqual([
      "belowGoalDirection",
      "caloriesChangeKcal",
      "clamps",
      "counts",
      "effectiveRatePctPerWeek",
      "expenditureChangeKcal",
      "expenditureRawChangeKcal",
      "expenditureStepClamped",
      "kind",
      "reasons",
      "varianceGrew",
    ]);
    expect(KINDS).toContain(summary.kind);
    summary.reasons.forEach((reason) => {
      expect(REASONS).toContain(reason);
    });
    summary.clamps.forEach((clamp) => {
      expect(CLAMP_CODES).toContain(clamp);
    });
    Object.values(summary.counts).forEach((count) => {
      expect(typeof count).toBe("number");
    });
    expect(typeof summary.expenditureChangeKcal).toBe("number");
    expect(typeof summary.expenditureRawChangeKcal).toBe("number");
    expect(typeof summary.expenditureStepClamped).toBe("boolean");
    expect(typeof summary.varianceGrew).toBe("boolean");
    expect(["number", "object"]).toContain(typeof summary.caloriesChangeKcal);
    expect(typeof summary.effectiveRatePctPerWeek).toBe("number");
    expect(typeof summary.belowGoalDirection).toBe("boolean");
  }

  it("should hold for a measured, a not measured, a start and a recompute summary", () => {
    const first = runCheckin(GOLDEN, 14);
    const week = runCheckin(INELIGIBLE, 14, { bmrKcal: 3000 });
    const startSnapshot: ProgramSnapshot = {
      kind: "start",
      asOfDate: "2026-10-23",
      muKcal: 2500,
      varKcal2: 140625,
      measurement: null,
    };
    const recomputed: ProgramTargets = {
      caloriesKcal: 2100,
      basis: { ...targetsOf(week).basis, source: "recompute" },
    };

    [
      checkinSummary(startTargets(first), targetsOf(first), snapshotOf(first)),
      checkinSummary(startTargets(week), targetsOf(week), snapshotOf(week)),
      checkinSummary(null, startTargets(first), startSnapshot),
      checkinSummary(targetsOf(week), recomputed, snapshotOf(week)),
    ].forEach(expectNoWords);
  });
});
