import { describe, expect, it } from "vitest";

import {
  MEAL_PLAN_BAND_TIMES,
  MEAL_PLAN_DEFAULT_REPEAT_LIMIT,
  MEAL_PLAN_NO_REPEAT_LIMIT,
  repeatLimitOfProfile,
} from "../../src/plans";

describe("the meal plan constants", () => {
  it("should start a person who has not chosen at 2 repeats a week", () => {
    expect(MEAL_PLAN_DEFAULT_REPEAT_LIMIT).toBe(2);
  });

  it("should write no limit as 0 in the profile", () => {
    expect(MEAL_PLAN_NO_REPEAT_LIMIT).toBe(0);
  });

  it("should time the bands at 07:30, 12:30 and 19:00", () => {
    expect(MEAL_PLAN_BAND_TIMES).toEqual({ morning: "07:30", midday: "12:30", evening: "19:00" });
  });
});

describe("repeatLimitOfProfile", () => {
  it("should resolve an unset profile to the starting limit", () => {
    expect(repeatLimitOfProfile(null)).toBe(2);
  });

  it("should read 0 as no limit, which the plan stores as null", () => {
    expect(repeatLimitOfProfile(0)).toBeNull();
  });

  it.each([1, 2, 3, 4, 5, 6, 7])("should keep a chosen limit of %i", (limit) => {
    expect(repeatLimitOfProfile(limit)).toBe(limit);
  });

  it.each([-1, 8, 1.5, Number.NaN])("should refuse %s", (value) => {
    expect(() => repeatLimitOfProfile(value)).toThrow(RangeError);
  });
});
