import { describe, expect, it } from "vitest";

import { DEFAULT_ENGINE_PARAMS, targetsRow } from "../../src/engine";
import { targetsBasisSchema } from "../../src/schemas";

import type { CheckinProgram } from "../../src/engine";

/*
 * The one place the targets row of a check-in and of a recompute is assembled. The figures are the day 28
 * golden of ADR 0002, Amendment 2 (mu 2579.54, trend weight 79.0227 kg, BMR 1755 give 2140 kcal, P 126,
 * F 73, C 245) and the 6000 cap case of `recomputeTargets.test.ts`, as literals.
 */

const LOSE_HALF_A_PERCENT: CheckinProgram = {
  goal: "lose",
  ratePctPerWeek: 0.5,
  proteinGPerKg: 1.6,
  fatFraction: 0.4,
  dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
};

const DAY_28 = {
  source: "checkin",
  effectiveFrom: "2026-04-30",
  muKcal: 2579.54,
  trendWeightKg: 79.0227,
  program: LOSE_HALF_A_PERCENT,
  bmrKcal: 1755,
} as const;

describe("targetsRow", () => {
  it("should give 2140 kcal, P 126, F 73, C 245 and the same calories on every weekday", () => {
    const row = targetsRow(DAY_28);

    expect([row.calories_kcal, row.protein_g, row.fat_g, row.carbs_g]).toStrictEqual([
      2140, 126, 73, 245,
    ]);
    expect(row.dow_calories_kcal).toStrictEqual([2140, 2140, 2140, 2140, 2140, 2140, 2140]);
  });

  it.each(["start", "checkin", "recompute"] as const)(
    "should record the source %s it is given on the basis",
    (source) => {
      expect(targetsRow({ ...DAY_28, source }).basis.source).toBe(source);
    },
  );

  it("should make the row effective from the date it is given", () => {
    expect(targetsRow({ ...DAY_28, effectiveFrom: "2026-05-02" }).effective_from).toBe(
      "2026-05-02",
    );
  });

  it("should record the numbers that decided the targets on the basis", () => {
    expect(targetsRow(DAY_28).basis).toMatchObject({
      tdeeKcal: 2579.54,
      trendWeightKg: 79.0227,
      bmrKcal: 1755,
      goal: "lose",
      ratePctPerWeek: 0.5,
      proteinGPerKg: 1.6,
      fatFraction: 0.4,
      dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
      clamps: [],
    });
  });

  it("should cut the calories to 6000, split the macros again and record profile_max", () => {
    const row = targetsRow({
      ...DAY_28,
      muKcal: 5900,
      trendWeightKg: 100,
      program: { ...LOSE_HALF_A_PERCENT, goal: "gain" },
    });

    expect([row.calories_kcal, row.protein_g, row.fat_g, row.carbs_g]).toStrictEqual([
      6000, 160, 238, 805,
    ]);
    expect(row.basis.clamps).toStrictEqual(["profile_max"]);
    expect(row.basis.effectiveRatePctPerWeek).toBeCloseTo(0.0909091, 6);
  });

  it("should write a basis the KEY-620 schema accepts", () => {
    expect(targetsBasisSchema.safeParse(targetsRow(DAY_28).basis).success).toBe(true);
  });

  it("should carry the engine version and the whole default params", () => {
    const row = targetsRow(DAY_28);

    expect(row.engine_version).toBe("keylow-engine-v1");
    expect(row.params).toStrictEqual(DEFAULT_ENGINE_PARAMS);
  });

  it("should copy the offsets, so the row does not share the program's array", () => {
    const offsets: CheckinProgram["dowOffsetsKcal"] = [-300, 300, 0, 0, 0, 0, 0];
    const row = targetsRow({
      ...DAY_28,
      program: { ...LOSE_HALF_A_PERCENT, dowOffsetsKcal: offsets },
    });

    expect(row.basis.dowOffsetsKcal).toStrictEqual([-300, 300, 0, 0, 0, 0, 0]);
    expect(row.basis.dowOffsetsKcal).not.toBe(offsets);
  });
});
