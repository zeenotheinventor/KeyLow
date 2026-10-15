import { describe, expect, it } from "vitest";

import { incompleteDaysThisWeek } from "../../../src/diary/rules/incompleteDaysThisWeek";

const complete = (local_date: string) => ({ local_date, is_complete: true });
const notComplete = (local_date: string) => ({ local_date, is_complete: false });

// 2026-10-12 is a Monday, so the week of 12 to 18 October.
const noonUtcOn = (date: string) => new Date(`${date}T12:00:00Z`);

describe("incompleteDaysThisWeek", () => {
  it("should count only Monday when today is Monday", () => {
    expect(incompleteDaysThisWeek([], noonUtcOn("2026-10-12"), "UTC")).toBe(1);
  });

  it("should count nothing when today is Monday and Monday is complete", () => {
    expect(incompleteDaysThisWeek([complete("2026-10-12")], noonUtcOn("2026-10-12"), "UTC")).toBe(
      0,
    );
  });

  it("should count Monday to Thursday when today is Thursday", () => {
    expect(incompleteDaysThisWeek([], noonUtcOn("2026-10-15"), "UTC")).toBe(4);
  });

  it("should leave out the days marked complete", () => {
    const days = [complete("2026-10-12"), complete("2026-10-14")];

    expect(incompleteDaysThisWeek(days, noonUtcOn("2026-10-15"), "UTC")).toBe(2);
  });

  it("should count a day with a row that is not complete", () => {
    const days = [notComplete("2026-10-12"), complete("2026-10-13")];

    expect(incompleteDaysThisWeek(days, noonUtcOn("2026-10-15"), "UTC")).toBe(3);
  });

  it("should count all seven days when today is Sunday", () => {
    expect(incompleteDaysThisWeek([], noonUtcOn("2026-10-18"), "UTC")).toBe(7);
  });

  it("should count the one open day when today is Sunday and the other six are complete", () => {
    const days = [
      "2026-10-12",
      "2026-10-13",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ].map(complete);

    expect(incompleteDaysThisWeek(days, noonUtcOn("2026-10-18"), "UTC")).toBe(1);
  });

  it("should never count a future day, complete or not", () => {
    const days = [complete("2026-10-16"), notComplete("2026-10-17"), complete("2026-10-18")];

    expect(incompleteDaysThisWeek(days, noonUtcOn("2026-10-15"), "UTC")).toBe(4);
  });

  it("should ignore completed days from last week", () => {
    const days = [complete("2026-10-09"), complete("2026-10-11")];

    expect(incompleteDaysThisWeek(days, noonUtcOn("2026-10-13"), "UTC")).toBe(2);
  });

  it("should count a day once when the list holds it twice", () => {
    const days = [complete("2026-10-12"), complete("2026-10-12")];

    expect(incompleteDaysThisWeek(days, noonUtcOn("2026-10-14"), "UTC")).toBe(2);
  });

  it("should start the week in the previous month when it crosses a month boundary", () => {
    // Wednesday 2 September 2026, so the week began on Monday 31 August.
    const days = [complete("2026-08-31"), complete("2026-09-01")];

    expect(incompleteDaysThisWeek([], noonUtcOn("2026-09-02"), "UTC")).toBe(3);
    expect(incompleteDaysThisWeek(days, noonUtcOn("2026-09-02"), "UTC")).toBe(1);
  });

  it("should start the week in the previous year when it crosses a year boundary", () => {
    // Thursday 1 January 2026, so the week began on Monday 29 December 2025.
    expect(incompleteDaysThisWeek([], noonUtcOn("2026-01-01"), "UTC")).toBe(4);
    expect(incompleteDaysThisWeek([complete("2025-12-31")], noonUtcOn("2026-01-01"), "UTC")).toBe(
      3,
    );
  });

  it("should count the week the time zone says today is in", () => {
    // 23:30 UTC on Sunday 18 October is already Monday 19 October in Auckland.
    const instant = new Date("2026-10-18T23:30:00Z");

    expect(incompleteDaysThisWeek([], instant, "UTC")).toBe(7);
    expect(incompleteDaysThisWeek([], instant, "Pacific/Auckland")).toBe(1);
  });
});
