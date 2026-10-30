import { describe, expect, it } from "vitest";

import { describeGap } from "../../src/copy";

import type { GapNoteDay } from "../../src/copy";
import type { MuscleId } from "../../src/training";

const BEHIND = 0;
const ON_PLAN = 1;
const NOT_IN_PLAN = 3;

const LEAD = "Gap compares this week's sets with your plan, so it has no Actual or Projected.";
const SO_FAR = "It counts your planned days up to yesterday, and today once you have logged it.";

const MUSCLES_IN_PLAN = [
  "chest_upper",
  "chest_lower",
  "delt_front",
  "delt_side",
  "triceps",
  "abs",
] as const satisfies readonly MuscleId[];

function valuesOf(behind: readonly MuscleId[]): Partial<Record<MuscleId, number>> {
  return Object.fromEntries(
    MUSCLES_IN_PLAN.map((muscle) => [muscle, behind.includes(muscle) ? BEHIND : ON_PLAN]),
  );
}

function missedDay(date: string, plannedDayName: string): GapNoteDay {
  return { date, status: "missed", plannedDayName };
}

describe("describeGap", () => {
  it("should name the muscles that read behind, in the order of the muscle list, in lower case", () => {
    const note = describeGap({
      values: valuesOf(["triceps", "chest_upper", "delt_side"]),
      days: [missedDay("2026-10-17", "Push")],
      countsWholeWeek: true,
    });

    expect(note).toBe(
      `${LEAD} Saturday's Push was missed, so upper chest, side delts and triceps are behind.`,
    );
  });

  it("should follow the missed sessions of the week, in the plural when there are two", () => {
    const note = describeGap({
      values: valuesOf(["chest_upper", "chest_lower"]),
      days: [missedDay("2026-10-13", "Pull"), missedDay("2026-10-17", "Push")],
      countsWholeWeek: true,
    });

    expect(note).toBe(
      `${LEAD} Tuesday's Pull and Saturday's Push were missed, so upper chest and lower chest are behind.`,
    );
  });

  it("should leave a missed session out when no muscle reads behind", () => {
    const note = describeGap({
      values: { ...valuesOf([]), abs: NOT_IN_PLAN },
      days: [missedDay("2026-10-17", "Push")],
      countsWholeWeek: true,
    });

    expect(note).toBe(LEAD);
  });

  it("should ignore a day that was not missed", () => {
    const note = describeGap({
      values: valuesOf(["triceps"]),
      days: [
        { date: "2026-10-15", status: "logged", plannedDayName: "Legs" },
        { date: "2026-10-16", status: "rest", plannedDayName: null },
      ],
      countsWholeWeek: true,
    });

    expect(note).toBe(LEAD);
  });

  it("should add that the gap counts the days so far while the week is on", () => {
    const note = describeGap({
      values: valuesOf([]),
      days: [],
      countsWholeWeek: false,
    });

    expect(note).toBe(`${LEAD} ${SO_FAR}`);
  });

  it("should put the days so far after the missed sessions", () => {
    const note = describeGap({
      values: valuesOf(["abs"]),
      days: [missedDay("2026-10-13", "Pull")],
      countsWholeWeek: false,
    });

    expect(note).toBe(`${LEAD} Tuesday's Pull was missed, so abs are behind. ${SO_FAR}`);
  });
});
