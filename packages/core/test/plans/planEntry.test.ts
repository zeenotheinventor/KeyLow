import { describe, expect, it } from "vitest";

import { planPrefillDatesOf, repeatLimitSelectionOf } from "../../src/plans";

describe("planPrefillDatesOf", () => {
  it("should plan from today to the coming Sunday when pressed midweek", () => {
    expect(planPrefillDatesOf("2026-11-18")).toEqual({ start: "2026-11-18", end: "2026-11-22" });
  });

  it("should plan the whole week on a Monday", () => {
    expect(planPrefillDatesOf("2026-11-16")).toEqual({ start: "2026-11-16", end: "2026-11-22" });
  });

  it("should plan the next seven days on a Sunday", () => {
    expect(planPrefillDatesOf("2026-11-22")).toEqual({ start: "2026-11-22", end: "2026-11-28" });
  });
});

describe("repeatLimitSelectionOf", () => {
  it("should mark the starting limit of twice a week while nothing is chosen", () => {
    expect(repeatLimitSelectionOf(null)).toEqual({ value: 2, isStarting: true });
  });

  it("should mark the person's own choice, No limit being 0", () => {
    expect(repeatLimitSelectionOf(0)).toEqual({ value: 0, isStarting: false });
    expect(repeatLimitSelectionOf(2)).toEqual({ value: 2, isStarting: false });
  });
});
