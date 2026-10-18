import { describe, expect, it } from "vitest";

import { heatSet, lateralRaise, repeat } from "./heatSets";
import { COMPARE_PARAMS_V1, compareWeek, MUSCLE_IDS, PLAN_STATUSES } from "../../src/training";

import type { CompareParams } from "../../src/training";

const params = COMPARE_PARAMS_V1;

describe("compareWeek", () => {
  it("should give every muscle id, in the order of the list, at 0 and on plan with no sets", () => {
    const comparison = compareWeek([], [], params);

    expect(Object.keys(comparison)).toEqual([...MUSCLE_IDS]);
    for (const muscle of Object.values(comparison)) {
      expect(muscle).toStrictEqual({
        actualWeeklySets: 0,
        projectedWeeklySets: 0,
        gap: 0,
        status: "on_plan",
      });
    }
  });

  it("should name its statuses", () => {
    expect(PLAN_STATUSES).toEqual(["behind", "on_plan", "ahead"]);
  });

  it("should be on plan within the 1-set tolerance, the tolerance included", () => {
    const projected = repeat(4, heatSet(lateralRaise));
    const status = (actualSets: number) =>
      compareWeek(repeat(actualSets, heatSet(lateralRaise)), projected, params).delt_side.status;

    expect(status(2)).toBe("behind");
    expect(status(3)).toBe("on_plan");
    expect(status(4)).toBe("on_plan");
    expect(status(5)).toBe("on_plan");
    expect(status(6)).toBe("ahead");
  });

  it("should weight sets by muscle weight and effort, as weeklyVolume does", () => {
    // traps_upper takes 0.3 of a lateral raise. Three sets at RIR 4 (effort 0.5) are 0.45 sets.
    const actual = repeat(3, heatSet(lateralRaise, { rir: 4 }));
    const projected = repeat(3, heatSet(lateralRaise));
    const comparison = compareWeek(actual, projected, params);

    expect(comparison.traps_upper).toStrictEqual({
      actualWeeklySets: 0.45,
      projectedWeeklySets: 0.9,
      gap: -0.45,
      status: "on_plan",
    });
    expect(comparison.delt_side.gap).toBe(-1.5);
    expect(comparison.delt_side.status).toBe("behind");
  });

  it("should not count warm-ups or deleted sets", () => {
    const actual = [
      heatSet(lateralRaise, { set_type: "warmup" }),
      heatSet(lateralRaise, { deleted_at: "2026-10-18T09:00:00.000Z" }),
    ];
    expect(compareWeek(actual, [], params).delt_side.actualWeeklySets).toBe(0);
  });

  it("should count every set given, whenever it was performed", () => {
    const longAgo = heatSet(lateralRaise, { performed_at: "2020-01-01T00:00:00.000Z" });
    expect(compareWeek([longAgo], [], params).delt_side.actualWeeklySets).toBe(1);
  });

  it("should read a gap of exactly 0 through floating point drift", () => {
    // Ten sets at a weight of 0.1 against one at a weight of 1.
    const tenth = [{ muscle_id: "neck", role: "primary", weight: 0.1 }] as const;
    const whole = [{ muscle_id: "neck", role: "primary", weight: 1 }] as const;
    const comparison = compareWeek(repeat(10, heatSet(tenth)), [heatSet(whole)], params);

    expect(Object.is(comparison.neck.gap, 0)).toBe(true);
  });

  it("should use the params' tolerance", () => {
    const strict: CompareParams = { ...params, onPlanToleranceSets: 0 };
    const comparison = compareWeek([heatSet(lateralRaise)], [], strict);

    expect(comparison.delt_side.status).toBe("ahead");
    expect(compareWeek([heatSet(lateralRaise)], [], params).delt_side.status).toBe("on_plan");
  });

  it("should refuse a set whose performed_at has no zone", () => {
    expect(() =>
      compareWeek([heatSet(lateralRaise, { performed_at: "2026-10-18T08:00:00" })], [], params),
    ).toThrow(new RangeError("A set's performed_at must be an ISO timestamp with a zone"));
  });
});
