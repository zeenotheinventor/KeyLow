import { describe, expect, it } from "vitest";

import { plannedDayOf } from "../../src/hooks/plannedDayOf";

import type { PlanRoutineDay } from "@keylow/core/training";

const dayOn = (weekday: number | null, id: string): PlanRoutineDay => ({
  id,
  position: 0,
  weekday,
  exercises: [],
});

const MONDAY_DAY = dayOn(0, "monday-day");
const SUNDAY_DAY = dayOn(6, "sunday-day");
const ANY_DAY = dayOn(null, "any-day");

// 12 October 2026 is a Monday, 18 October a Sunday.
describe("plannedDayOf", () => {
  const routine = { days: [ANY_DAY, SUNDAY_DAY, MONDAY_DAY] };

  it("should give the routine day whose weekday is the weekday of the day", () => {
    expect(plannedDayOf(routine, "2026-10-12")).toBe(MONDAY_DAY);
  });

  it("should count Sunday as weekday 6, the last day of the week", () => {
    expect(plannedDayOf(routine, "2026-10-18")).toBe(SUNDAY_DAY);
  });

  it("should give nothing for a weekday the routine has no day on, and never the any-day one", () => {
    expect(plannedDayOf(routine, "2026-10-14")).toBeUndefined();
  });

  it("should give nothing when there is no routine", () => {
    expect(plannedDayOf(null, "2026-10-12")).toBeUndefined();
  });

  it("should give nothing for a day before the routine was made active, and the day itself", () => {
    const active = { ...routine, activeFrom: "2026-10-12" };

    expect(plannedDayOf(active, "2026-10-05")).toBeUndefined();
    expect(plannedDayOf(active, "2026-10-12")).toBe(MONDAY_DAY);
  });
});
