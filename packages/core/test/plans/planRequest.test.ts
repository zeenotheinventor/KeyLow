import { describe, expect, it } from "vitest";

import { planDatesOf, planTargetOf, resolveRepeatLimit } from "../../src/plans";

describe("planDatesOf", () => {
  it("should run a Monday plan through the whole week", () => {
    expect(planDatesOf("2026-11-16", null)).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
  });

  it("should run a midweek plan to the coming Sunday", () => {
    expect(planDatesOf("2026-11-18", null)).toEqual([
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
  });

  it("should give a Sunday the next seven days", () => {
    expect(planDatesOf("2026-11-22", null)).toHaveLength(7);
  });

  it("should take the number of days asked for, and never more than seven", () => {
    expect(planDatesOf("2026-11-18", 3)).toEqual(["2026-11-18", "2026-11-19", "2026-11-20"]);
    expect(planDatesOf("2026-11-18", 9)).toHaveLength(7);
  });
});

describe("planTargetOf", () => {
  const figures = { kcal: 1300, protein_g: 90, carbs_g: 150, fat_g: 50 };

  it("should judge calories and protein only", () => {
    expect(planTargetOf(figures, [])).toEqual({ kcal: 1300, protein_g: 90 });
  });

  it("should add carbs or fat only when they were named", () => {
    expect(planTargetOf(figures, ["carbs_g"])).toEqual({ kcal: 1300, protein_g: 90, carbs_g: 150 });
    expect(planTargetOf(figures, ["carbs_g", "fat_g"])).toEqual(figures);
  });

  it("should leave out a figure the person has not set", () => {
    expect(planTargetOf({ ...figures, protein_g: null, fat_g: null }, ["fat_g"])).toEqual({
      kcal: 1300,
    });
  });

  it("should give no target without calories", () => {
    expect(planTargetOf({ ...figures, kcal: null }, [])).toBeNull();
  });
});

describe("resolveRepeatLimit", () => {
  it("should take the request first", () => {
    expect(resolveRepeatLimit(3, 5)).toEqual({ maxRepeats: 3, source: "request" });
  });

  it("should read a request of 0 as no limit", () => {
    expect(resolveRepeatLimit(0, 5)).toEqual({ maxRepeats: null, source: "request" });
  });

  it("should take the profile when the request says nothing", () => {
    expect(resolveRepeatLimit(null, 4)).toEqual({ maxRepeats: 4, source: "profile" });
    expect(resolveRepeatLimit(null, 0)).toEqual({ maxRepeats: null, source: "profile" });
  });

  it("should fall back to the starting limit of 2", () => {
    expect(resolveRepeatLimit(null, null)).toEqual({ maxRepeats: 2, source: "default" });
  });

  it("should refuse a limit outside 0 to 7", () => {
    expect(() => resolveRepeatLimit(8, null)).toThrow(RangeError);
  });
});
