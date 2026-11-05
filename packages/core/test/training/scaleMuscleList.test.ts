import { describe, expect, it } from "vitest";

import { describeWebListCaption } from "../../src/copy";
import { MUSCLE_IDS, gapValues, musclesAgainstPlan, musclesByVolume } from "../../src/training";
import goldenWeek from "../fixtures/training/goldenWeek.json";

import type { MuscleId, MusclePlanComparison } from "../../src/training";

/*
 * The Muscles card of the web body map on Volume and Gap, worked from the golden week of KEY-353 as it
 * stands on Sunday 18 October at 20:00, with the weekly sets Zee agreed (the fixture's `planWeek`). The rows,
 * their order and the counts are those `web-body · volume` and `web-body · gap` draw.
 */

const golden = goldenWeek.expected.planWeek.muscles as Record<MuscleId, MusclePlanComparison>;

// The routine trains every muscle but these seven, which have no sets planned or done.
const UNTARGETED = new Set<MuscleId>([
  "traps_upper",
  "abs",
  "obliques",
  "glute_med",
  "adductors",
  "tibialis",
  "neck",
]);
const targeted = new Set(MUSCLE_IDS.filter((muscle) => !UNTARGETED.has(muscle)));

const comparisonOf = (
  changes: Partial<
    Record<MuscleId, Pick<MusclePlanComparison, "actualWeeklySets" | "projectedWeeklySets">>
  >,
): Record<MuscleId, MusclePlanComparison> =>
  Object.fromEntries(
    MUSCLE_IDS.map((muscle) => {
      const { actualWeeklySets, projectedWeeklySets } = changes[muscle] ?? {
        actualWeeklySets: 0,
        projectedWeeklySets: 0,
      };
      const gap = Math.round((actualWeeklySets - projectedWeeklySets) * 100) / 100;
      const status = gap < -1 ? "behind" : gap > 1 ? "ahead" : "on_plan";
      return [muscle, { actualWeeklySets, projectedWeeklySets, gap, status }];
    }),
  ) as Record<MuscleId, MusclePlanComparison>;

const gapOf = (comparison: Record<MuscleId, MusclePlanComparison>, inPlan = targeted) =>
  musclesAgainstPlan(comparison, gapValues(comparison, inPlan));

describe("musclesByVolume on the golden Sunday 20:00", () => {
  const projected = musclesByVolume(golden, "projected");

  it("should list the twelve muscles at Growing or above, most sets first, as the board does", () => {
    expect(
      projected.rows.map(({ muscle, weeklySets, status }) => [muscle, weeklySets, status]),
    ).toStrictEqual([
      ["triceps", 15, "productive"],
      ["delt_front", 12, "productive"],
      ["delt_side", 11, "productive"],
      ["lats", 11, "productive"],
      ["chest_upper", 9.6, "growing"],
      ["chest_lower", 9, "growing"],
      ["biceps", 8.5, "growing"],
      ["traps_mid", 7.75, "growing"],
      ["delt_rear", 5.5, "growing"],
      ["hamstrings", 5.5, "growing"],
      ["quads", 5, "growing"],
      ["glute_max", 4, "growing"],
    ]);
  });

  it("should count the three muscles still maintaining and the seven not trained", () => {
    expect(projected.moreMaintaining).toBe(3);
    expect(projected.notTrained).toBe(7);
    expect(describeWebListCaption(projected)).toBe(
      "Most sets first · 3 more maintaining, 7 not trained",
    );
  });

  it("should count the sets logged so far in Actual", () => {
    const actual = musclesByVolume(golden, "actual");

    expect(actual.rows.map(({ muscle, weeklySets }) => [muscle, weeklySets])).toStrictEqual([
      ["lats", 11],
      ["biceps", 8.5],
      ["traps_mid", 7.75],
      ["triceps", 7.5],
      ["delt_front", 6],
      ["delt_side", 5.5],
      ["delt_rear", 5.5],
      ["hamstrings", 5.5],
      ["quads", 5],
      ["chest_upper", 4.8],
      ["chest_lower", 4.5],
      ["glute_max", 4],
    ]);
  });

  it("should keep the order of the muscle list between muscles with the same sets", () => {
    const tied = comparisonOf({
      quads: { actualWeeklySets: 6, projectedWeeklySets: 6 },
      delt_rear: { actualWeeklySets: 6, projectedWeeklySets: 6 },
      lats: { actualWeeklySets: 6, projectedWeeklySets: 6 },
    });

    expect(musclesByVolume(tied, "actual").rows.map(({ muscle }) => muscle)).toStrictEqual([
      "delt_rear",
      "lats",
      "quads",
    ]);
  });

  it("should leave out a muscle whose sets drifted just under a tie, not order it by the drift", () => {
    const drift = comparisonOf({
      quads: { actualWeeklySets: 5.499999999, projectedWeeklySets: 5.499999999 },
      delt_rear: { actualWeeklySets: 5.5, projectedWeeklySets: 5.5 },
    });

    expect(musclesByVolume(drift, "actual").rows.map(({ muscle }) => muscle)).toStrictEqual([
      "delt_rear",
      "quads",
    ]);
  });

  it("should say the week is empty with no rows when nothing is trained", () => {
    const nothing = musclesByVolume(comparisonOf({}), "actual");

    expect(nothing).toStrictEqual({
      scale: "volume",
      rows: [],
      moreMaintaining: 0,
      notTrained: 22,
    });
  });
});

describe("musclesAgainstPlan on the golden Sunday 20:00", () => {
  const gap = gapOf(golden);

  it("should list the furthest behind first, then the muscles on plan with the most sets, as the board does", () => {
    expect(
      gap.rows.map(({ muscle, done, planned, status }) => [muscle, done, planned, status]),
    ).toStrictEqual([
      ["triceps", 7.5, 15, "behind"],
      ["delt_front", 6, 12, "behind"],
      ["delt_side", 5.5, 11, "behind"],
      ["chest_upper", 4.8, 9.6, "behind"],
      ["chest_lower", 4.5, 9, "behind"],
      ["lats", 11, 11, "on_plan"],
      ["biceps", 8.5, 8.5, "on_plan"],
      ["traps_mid", 7.75, 7.75, "on_plan"],
      ["delt_rear", 5.5, 5.5, "on_plan"],
      ["hamstrings", 5.5, 5.5, "on_plan"],
      ["quads", 5, 5, "on_plan"],
      ["glute_max", 4, 4, "on_plan"],
    ]);
  });

  it("should count the three muscles on plan that the rows leave out and the seven not in the plan", () => {
    expect(gap.moreOnPlan).toBe(3);
    expect(gap.notInPlan).toBe(7);
    expect(describeWebListCaption(gap)).toBe(
      "Furthest behind first · 3 more on plan, 7 not in plan",
    );
  });

  it("should never list a muscle that is not in the plan, whatever its gap", () => {
    const comparison = comparisonOf({
      quads: { actualWeeklySets: 5, projectedWeeklySets: 5 },
      neck: { actualWeeklySets: 0, projectedWeeklySets: 8 },
    });

    const result = gapOf(comparison, new Set<MuscleId>(["quads"]));

    expect(result.rows.map(({ muscle }) => muscle)).toStrictEqual(["quads"]);
    expect(result.notInPlan).toBe(21);
  });

  it("should list a muscle that is ahead of the plan after those on plan", () => {
    const comparison = comparisonOf({
      quads: { actualWeeklySets: 9, projectedWeeklySets: 5 },
      lats: { actualWeeklySets: 11, projectedWeeklySets: 11 },
      triceps: { actualWeeklySets: 5, projectedWeeklySets: 9 },
    });

    expect(
      gapOf(comparison, new Set<MuscleId>(["quads", "lats", "triceps"])).rows.map(
        ({ muscle, status }) => [muscle, status],
      ),
    ).toStrictEqual([
      ["triceps", "behind"],
      ["lats", "on_plan"],
      ["quads", "ahead"],
    ]);
  });

  it("should list a muscle that is behind even when its plan is small", () => {
    const comparison = comparisonOf({ calves: { actualWeeklySets: 0, projectedWeeklySets: 3 } });

    const result = gapOf(comparison, new Set<MuscleId>(["calves"]));

    expect(result.rows.map(({ muscle, status }) => [muscle, status])).toStrictEqual([
      ["calves", "behind"],
    ]);
    expect(result.moreOnPlan).toBe(0);
  });
});
