import { describe, expect, it } from "vitest";

import { dayTarget } from "../../src/engine";

import type { DayOfWeekKcal } from "../../src/engine";

// Monday first: a different figure for each weekday, so a wrong index cannot pass by luck.
const weekKcal: DayOfWeekKcal = [2010, 2020, 2030, 2040, 2050, 2060, 2070];

const targets = { caloriesKcal: 2000, dowCaloriesKcal: weekKcal };

describe("dayTarget weekday", () => {
  it("should read index 0 for 2026-10-19, a Monday", () => {
    expect(dayTarget(targets, "2026-10-19")).toBe(2010);
  });

  it("should read index 6 for 2026-10-25, a Sunday", () => {
    expect(dayTarget(targets, "2026-10-25")).toBe(2070);
  });

  it("should read index 1 to 5 for the Tuesday to Saturday between them", () => {
    expect(dayTarget(targets, "2026-10-20")).toBe(2020);
    expect(dayTarget(targets, "2026-10-21")).toBe(2030);
    expect(dayTarget(targets, "2026-10-22")).toBe(2040);
    expect(dayTarget(targets, "2026-10-23")).toBe(2050);
    expect(dayTarget(targets, "2026-10-24")).toBe(2060);
  });

  it("should start the next week again at index 0 on 2026-10-26, a Monday", () => {
    expect(dayTarget(targets, "2026-10-26")).toBe(2010);
  });

  it("should read index 1 for 2028-02-29, a Tuesday in a leap year", () => {
    expect(dayTarget(targets, "2028-02-29")).toBe(2020);
  });

  it("should read index 3 for 2026-01-01, a Thursday, across a year boundary", () => {
    expect(dayTarget(targets, "2026-01-01")).toBe(2040);
    expect(dayTarget(targets, "2025-12-31")).toBe(2030);
  });

  it("should throw a RangeError for text that is not a date", () => {
    expect(() => dayTarget(targets, "not-a-date")).toThrow(RangeError);
  });
});

describe("dayTarget with no day of week figures", () => {
  it("should return the calories for a manual target", () => {
    expect(dayTarget({ caloriesKcal: 2000 }, "2026-10-19")).toBe(2000);
    expect(dayTarget({ caloriesKcal: 2000 }, "2026-10-25")).toBe(2000);
  });
});

describe("dayTarget adjustments", () => {
  it("should add 120 to the day's calories for { kcal: 120 }", () => {
    expect(dayTarget(targets, "2026-10-19", { kcal: 120 })).toBe(2130);
  });

  it("should add a negative adjustment as it is", () => {
    expect(dayTarget(targets, "2026-10-25", { kcal: -70 })).toBe(2000);
  });

  it("should add the adjustment to the calories of a manual target", () => {
    expect(dayTarget({ caloriesKcal: 2000 }, "2026-10-19", { kcal: 120 })).toBe(2120);
  });

  it("should not round the adjustment", () => {
    expect(dayTarget(targets, "2026-10-19", { kcal: 12.5 })).toBe(2022.5);
  });

  it("should give the day's calories exactly when the adjustment is 0 or missing", () => {
    expect(dayTarget(targets, "2026-10-21", { kcal: 0 })).toBe(2030);
    expect(dayTarget(targets, "2026-10-21", undefined)).toBe(2030);
  });
});
