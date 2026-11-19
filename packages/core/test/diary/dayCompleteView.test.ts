import { describe, expect, it } from "vitest";

import { dayCompleteView, streakLineOf } from "../../src/diary";

const timeZone = "Europe/London";
const today = "2026-11-19";
const yesterday = "2026-11-18";

// A day with an entry, not complete, viewed online. A test changes only what it is about.
const base = {
  localDate: today,
  today,
  now: new Date("2026-11-19T15:00:00Z"),
  timeZone,
  entryCount: 2,
  isComplete: false,
  isOnline: true,
};

describe("dayCompleteView", () => {
  describe("a day with nothing logged", () => {
    it("should have no entries to complete", () => {
      expect(dayCompleteView({ ...base, entryCount: 0 }).state).toBe("noEntries");
    });

    it("should have no entries on yesterday inside its window too", () => {
      const view = dayCompleteView({
        ...base,
        localDate: yesterday,
        entryCount: 0,
        now: new Date("2026-11-19T09:00:00Z"),
      });

      expect(view.state).toBe("noEntries");
    });

    it("should still let a complete day be undone after its entries were deleted", () => {
      expect(dayCompleteView({ ...base, entryCount: 0, isComplete: true }).state).toBe(
        "completedToday",
      );
    });
  });

  describe("today", () => {
    it("should be ready to complete at 23:59", () => {
      const view = dayCompleteView({ ...base, now: new Date("2026-11-19T23:59:00Z") });

      expect(view).toEqual({ state: "ready", isInStreakWindow: true });
    });

    it("should be complete today once it is complete", () => {
      expect(dayCompleteView({ ...base, isComplete: true })).toEqual({
        state: "completedToday",
        isInStreakWindow: true,
      });
    });
  });

  describe("yesterday", () => {
    it("should still be completable at 11:59", () => {
      const view = dayCompleteView({
        ...base,
        localDate: yesterday,
        today: "2026-11-19",
        now: new Date("2026-11-19T11:59:00Z"),
      });

      expect(view).toEqual({ state: "yesterdayOpen", isInStreakWindow: true });
    });

    it("should be outside the window at 12:00", () => {
      const view = dayCompleteView({
        ...base,
        localDate: yesterday,
        now: new Date("2026-11-19T12:00:00Z"),
      });

      expect(view).toEqual({ state: "outsideWindow", isInStreakWindow: false });
    });

    // Clocks go back in London at 01:00 UTC on 25 October 2026, so noon that day is 12:00 UTC.
    it("should still be completable at 11:59 UTC on the day the clocks go back", () => {
      const view = dayCompleteView({
        ...base,
        localDate: "2026-10-24",
        today: "2026-10-25",
        now: new Date("2026-10-25T11:59:00Z"),
      });

      expect(view).toEqual({ state: "yesterdayOpen", isInStreakWindow: true });
    });

    it("should be outside the window at 12:00 UTC on the day the clocks go back", () => {
      const view = dayCompleteView({
        ...base,
        localDate: "2026-10-24",
        today: "2026-10-25",
        now: new Date("2026-10-25T12:00:00Z"),
      });

      expect(view).toEqual({ state: "outsideWindow", isInStreakWindow: false });
    });

    it("should follow the time zone and not UTC for the cutoff", () => {
      // 11:30 in New York is 16:30 UTC, still before 12:00 local.
      const view = dayCompleteView({
        ...base,
        localDate: yesterday,
        timeZone: "America/New_York",
        now: new Date("2026-11-19T16:30:00Z"),
      });

      expect(view.state).toBe("yesterdayOpen");
    });

    it("should be complete, with no streak number, when it was completed in time", () => {
      const view = dayCompleteView({
        ...base,
        localDate: yesterday,
        isComplete: true,
        now: new Date("2026-11-19T09:00:00Z"),
      });

      expect(view).toEqual({ state: "complete", isInStreakWindow: true });
    });
  });

  describe("an older day", () => {
    it("should be outside the window and not in the streak", () => {
      const view = dayCompleteView({ ...base, localDate: "2026-11-09" });

      expect(view).toEqual({ state: "outsideWindow", isInStreakWindow: false });
    });

    it("should be complete but outside the window once completed", () => {
      const view = dayCompleteView({ ...base, localDate: "2026-11-09", isComplete: true });

      expect(view).toEqual({ state: "complete", isInStreakWindow: false });
    });
  });

  describe("offline", () => {
    it("should say a complete day is saved on the phone", () => {
      expect(dayCompleteView({ ...base, isComplete: true, isOnline: false }).state).toBe(
        "savedOffline",
      );
    });

    it("should leave a day that is not complete as it is", () => {
      expect(dayCompleteView({ ...base, isOnline: false }).state).toBe("ready");
    });
  });
});

describe("streakLineOf", () => {
  const readyToday = { state: "ready", isInStreakWindow: true } as const;

  it("should be the streak with the reminder when today is ready to complete", () => {
    expect(streakLineOf(readyToday, today, today, 11)).toEqual({
      streakDays: 11,
      isAtRisk: true,
      hasFlame: true,
    });
  });

  it("should be the plain streak on a today that has nothing logged", () => {
    const view = { state: "noEntries", isInStreakWindow: true } as const;

    expect(streakLineOf(view, today, today, 11)).toEqual({
      streakDays: 11,
      isAtRisk: false,
      hasFlame: true,
    });
  });

  it("should be the plain streak on a today that is complete", () => {
    const view = { state: "completedToday", isInStreakWindow: true } as const;

    expect(streakLineOf(view, today, today, 12)?.isAtRisk).toBe(false);
  });

  it("should have no flame on yesterday, inside its window", () => {
    const view = { state: "yesterdayOpen", isInStreakWindow: true } as const;

    expect(streakLineOf(view, yesterday, today, 11)).toEqual({
      streakDays: 11,
      isAtRisk: false,
      hasFlame: false,
    });
  });

  it("should have no line on a day after today", () => {
    const view = { state: "ready", isInStreakWindow: true } as const;

    expect(streakLineOf(view, "2026-11-20", today, 11)).toBeNull();
  });

  it("should have no line on a day outside the window", () => {
    const view = { state: "outsideWindow", isInStreakWindow: false } as const;

    expect(streakLineOf(view, "2026-11-09", today, 11)).toBeNull();
  });

  it("should have no line while the streak is not known or is not running", () => {
    expect(streakLineOf(readyToday, today, today, null)).toBeNull();
    expect(streakLineOf(readyToday, today, today, 0)).toBeNull();
  });
});
