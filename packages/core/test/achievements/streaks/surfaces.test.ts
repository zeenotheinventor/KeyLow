import { describe, expect, it } from "vitest";

import {
  recentWeeksOf,
  streakCalendarRangeOf,
  streakChipStateOf,
  streakMonthOf,
} from "../../../src/achievements/streaks";

import type { CalendarDayState, DailyStreak, WeekRecord } from "../../../src/achievements/streaks";

const daily = (overrides: Partial<DailyStreak> = {}): DailyStreak => ({
  current: 12,
  longest: 31,
  today: "complete",
  yesterdayCompletable: false,
  calendar: [],
  freezesHeld: 3,
  freezesUsed: 0,
  backOnTrack: false,
  weekendRun: { current: 0, longest: 0 },
  ...overrides,
});

describe("streakCalendarRangeOf", () => {
  it("covers the whole month of today", () => {
    expect(streakCalendarRangeOf("2026-11-19")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });

  it("reaches back to yesterday on the first of the month, so the chip can see a freeze", () => {
    expect(streakCalendarRangeOf("2026-11-01")).toEqual({ from: "2026-10-31", to: "2026-11-30" });
  });

  it("ends on the 29th of a leap February", () => {
    expect(streakCalendarRangeOf("2028-02-10").to).toBe("2028-02-29");
  });
});

describe("streakChipStateOf", () => {
  const frozenYesterday: CalendarDayState[] = [
    { localDate: "2026-11-18", state: "frozen" },
    { localDate: "2026-11-19", state: "at_risk" },
  ];

  it("is none when there is no streak", () => {
    expect(streakChipStateOf(daily({ current: 0, today: "at_risk" }), "2026-11-19")).toBe("none");
  });

  it("is active when today is complete", () => {
    expect(streakChipStateOf(daily(), "2026-11-19")).toBe("active");
  });

  it("is at risk while today is not complete", () => {
    expect(streakChipStateOf(daily({ today: "at_risk" }), "2026-11-19")).toBe("at_risk");
  });

  it("is at risk, not freeze used, while today is not complete even if yesterday was frozen", () => {
    expect(
      streakChipStateOf(daily({ today: "at_risk", calendar: frozenYesterday }), "2026-11-19"),
    ).toBe("at_risk");
  });

  it("is freeze used when yesterday was frozen and today is complete", () => {
    expect(
      streakChipStateOf(daily({ today: "complete", calendar: frozenYesterday }), "2026-11-19"),
    ).toBe("freeze_used");
  });

  it("is not freeze used for a freeze from earlier in the month", () => {
    const calendar: CalendarDayState[] = [
      { localDate: "2026-11-14", state: "frozen" },
      { localDate: "2026-11-18", state: "complete" },
    ];

    expect(streakChipStateOf(daily({ calendar }), "2026-11-19")).toBe("active");
  });
});

describe("streakMonthOf", () => {
  it("lays the month out Monday first with blanks before the 1st", () => {
    const calendar: CalendarDayState[] = [
      { localDate: "2026-11-01", state: "complete" },
      { localDate: "2026-11-02", state: "frozen" },
    ];

    const weeks = streakMonthOf(calendar, "2026-11-19");

    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      { localDate: "2026-11-01", state: "complete" },
    ]);
    expect(weeks[1]?.[0]).toEqual({ localDate: "2026-11-02", state: "frozen" });
  });

  it("calls a day the calendar does not know future", () => {
    const weeks = streakMonthOf([], "2026-11-19");

    expect(weeks[5]?.[0]).toEqual({ localDate: "2026-11-30", state: "future" });
  });
});

describe("recentWeeksOf", () => {
  const today = "2026-11-19";
  const thisMonday = "2026-11-16";
  const week = (weekStart: string, achieved: number, required: number): WeekRecord => ({
    weekStart,
    achieved,
    required,
  });

  it("gives seven past weeks and this one, oldest first", () => {
    const { bars } = recentWeeksOf([], today, 8);

    expect(bars).toHaveLength(8);
    expect(bars[0]?.weekStart).toBe("2026-09-28");
    expect(bars[7]?.weekStart).toBe(thisMonday);
  });

  it("marks a past week complete when it reached its count and missed otherwise", () => {
    const { bars } = recentWeeksOf([week("2026-11-09", 4, 4), week("2026-11-02", 3, 4)], today, 8);

    expect(bars[6]?.state).toBe("complete");
    expect(bars[5]?.state).toBe("missed");
    expect(bars[4]?.state).toBe("missed");
  });

  it("marks this week at risk until it reaches its count, then complete", () => {
    expect(recentWeeksOf([week(thisMonday, 2, 4)], today, 8).bars[7]?.state).toBe("at_risk");
    expect(recentWeeksOf([week(thisMonday, 4, 4)], today, 8).bars[7]?.state).toBe("complete");
  });

  it("reports this week's progress, and a week with no record as none of one", () => {
    expect(recentWeeksOf([week(thisMonday, 2, 4)], today, 8)).toMatchObject({
      achieved: 2,
      required: 4,
    });
    expect(recentWeeksOf([], today, 8)).toMatchObject({ achieved: 0, required: 1 });
  });
});
