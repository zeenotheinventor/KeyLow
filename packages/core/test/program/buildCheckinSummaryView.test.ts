import { describe, expect, it } from "vitest";

import { beliefOf, DAY_ZERO, runCheckin, snapshotOf, startTargets, targetsOf } from "./checkinRows";
import {
  PROGRAM_CHECKIN_SUMMARY,
  describeCarriedForwardLine,
  describeCheckinDataLine,
  guardrailLineOrder,
} from "../../src/copy";
import { buildCheckinSummaryView, checkinSummary, expenditureBand } from "../../src/program";
import { goldenCheckinFixture, ineligibleCheckinFixture } from "../../src/testing";

import type { CheckinResult } from "../../src/engine";
import type { CheckinSnapshot, CheckinTargetsRow } from "../../src/program";

/*
 * The check-in summary card's words, built from the golden chain. The figures are the engine's, so each
 * expected sentence is a literal or the copy function applied to the literal figures.
 */

const GOLDEN = goldenCheckinFixture(DAY_ZERO);
const INELIGIBLE = ineligibleCheckinFixture(DAY_ZERO);
const PROTEIN_G = 126;
const FAT_G = 73;

function checkinSnapshot(result: CheckinResult): CheckinSnapshot {
  const snapshot = snapshotOf(result);
  if (snapshot.kind !== "checkin") {
    throw new Error("A check-in result should give a check-in snapshot");
  }
  return snapshot;
}

function rowOf(targets: ReturnType<typeof targetsOf>, effectiveFrom: string): CheckinTargetsRow {
  return { ...targets, effectiveFrom, effectiveTo: null, proteinG: PROTEIN_G, fatG: FAT_G };
}

function viewOf(result: CheckinResult, previousMuKcal: number | null = 2500) {
  const snapshot = checkinSnapshot(result);
  return buildCheckinSummaryView({
    snapshot,
    previousSnapshot:
      previousMuKcal === null
        ? null
        : {
            kind: "start",
            asOfDate: DAY_ZERO,
            muKcal: previousMuKcal,
            varKcal2: 90_000,
            measurement: null,
          },
    unit: "kg",
    targets: rowOf(targetsOf(result), snapshot.asOfDate),
    previousTargets: rowOf(startTargets(result), DAY_ZERO),
  });
}

describe("buildCheckinSummaryView of a check-in that measured", () => {
  const result = runCheckin(GOLDEN, 14);
  const view = viewOf(result);

  it("should be named by the date and say it measured", () => {
    expect(view?.name).toBe("Last check-in, Thursday 16 April, measured");
    expect(view?.dateText).toBe("Thursday 16 April");
    expect(view?.isMeasured).toBe(true);
  });

  it("should give the expenditure and the calorie target as two rows with their own names", () => {
    expect(view?.rows).toEqual([
      {
        label: PROGRAM_CHECKIN_SUMMARY.expenditureLabel,
        value: "2,500 to 2,560 kcal",
        name: "Expenditure: 2,500 to 2,560 kcal",
      },
      {
        label: PROGRAM_CHECKIN_SUMMARY.calorieTargetLabel,
        value: "2,060 to 2,120 kcal",
        name: "Calorie target: 2,060 to 2,120 kcal",
      },
    ]);
  });

  it("should open with the data line from the window's counts and add no guardrail", () => {
    expect(view?.lines).toEqual([
      { kind: "data", text: describeCheckinDataLine({ weighDays: 14, completeDays: 14 }) },
    ]);
  });

  it("should give nothing when the estimate before the check-in is not known", () => {
    expect(viewOf(result, null)).toBeNull();
  });
});

describe("buildCheckinSummaryView of a guardrail", () => {
  it("should add the step clamp line after the data line when the weekly step was cut", () => {
    const clamped = runCheckin(GOLDEN, 14, { prior: { muKcal: 3500, varKcal2: 140_625 } });
    const summary = checkinSummary(
      startTargets(clamped),
      targetsOf(clamped),
      checkinSnapshot(clamped),
    );

    const lines = viewOf(clamped, 3500)?.lines ?? [];

    expect(lines[0]?.kind).toBe("data");
    expect(lines.slice(1)).toEqual(
      guardrailLineOrder([
        { code: "expenditure_step", figures: { rawChangeKcal: summary.expenditureRawChangeKcal } },
      ]).map(({ text }) => ({ kind: "guardrail", text })),
    );
    expect(lines).toHaveLength(2);
  });

  it("should add the floor line when the calorie floor lifted the target", () => {
    const floored = runCheckin(GOLDEN, 14, { bmrKcal: 2400 });

    const lines = viewOf(floored)?.lines ?? [];

    expect(lines.map(({ kind }) => kind)).toContain("guardrail");
    expect(lines.filter(({ kind }) => kind === "guardrail")).not.toHaveLength(0);
  });
});

describe("buildCheckinSummaryView of a check-in that could not measure", () => {
  const result = runCheckin(INELIGIBLE, 14);
  const view = viewOf(result);

  it("should say it did not measure", () => {
    expect(view?.isMeasured).toBe(false);
    expect(view?.name).toBe("Last check-in, Thursday 16 April, not measured");
  });

  it("should carry the expenditure forward and keep the calorie target as it was", () => {
    expect(view?.rows.map(({ value }) => value)).toEqual([
      "2,500 kcal, carried forward",
      "2,060 kcal, no change",
    ]);
  });

  it("should give the reason, then the plain carried forward line with the likely range", () => {
    const band = expenditureBand(checkinSnapshot(result));

    expect(view?.lines.map(({ kind }) => kind)).toEqual(["reason", "plain"]);
    expect(view?.lines.at(-1)?.text).toBe(describeCarriedForwardLine(band));
  });

  it("should not need the estimate before it, because nothing moved", () => {
    expect(viewOf(result, null)).not.toBeNull();
  });
});

describe("buildCheckinSummaryView of the golden chain", () => {
  it("should say no change for the calories of the third check-in", () => {
    const first = runCheckin(GOLDEN, 14);
    const second = runCheckin(GOLDEN, 21, { prior: beliefOf(first) });
    const third = runCheckin(GOLDEN, 28, { prior: beliefOf(second) });
    const snapshot = checkinSnapshot(third);

    const view = buildCheckinSummaryView({
      snapshot,
      previousSnapshot: snapshotOf(second),
      unit: "kg",
      targets: rowOf(targetsOf(third), snapshot.asOfDate),
      previousTargets: rowOf(targetsOf(second), "2026-04-23"),
    });

    expect(view?.rows.at(1)?.value).toBe("2,140 kcal, no change");
  });
});
