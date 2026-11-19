import { describe, expect, it } from "vitest";

import { completeDay, completeRun, LONDON } from "./fixtures";
import { dailyStreak } from "../../../src/achievements/streaks";

import type { StreakDay } from "../../../src/achievements/streaks";

// 2026-01-05 is a Monday, and London is on GMT all of January, so a "+00:00" time is London time.
const streakOn = (days: StreakDay[], today: string, now: string, zone = LONDON) =>
  dailyStreak(days, [], today, new Date(now), zone);

describe("dailyStreak", () => {
  describe("today", () => {
    it("should be at risk, not broken, while today is not yet complete", () => {
      const result = streakOn(completeRun("2026-01-05", 3), "2026-01-08", "2026-01-08T09:00:00Z");

      expect(result.current).toBe(3);
      expect(result.today).toBe("at_risk");
    });

    it("should stay at risk right up to 23:59 and keep the streak", () => {
      const result = streakOn(completeRun("2026-01-05", 3), "2026-01-08", "2026-01-08T23:59:00Z");

      expect(result.current).toBe(3);
      expect(result.today).toBe("at_risk");
    });

    it("should add today once it is complete", () => {
      const days = completeRun("2026-01-05", 4);
      const result = streakOn(days, "2026-01-08", "2026-01-08T21:30:00Z");

      expect(result.current).toBe(4);
      expect(result.today).toBe("complete");
    });

    it("should start a streak of one for a first complete day", () => {
      const result = streakOn([completeDay("2026-01-08")], "2026-01-08", "2026-01-08T21:30:00Z");

      expect(result.current).toBe(1);
      expect(result.longest).toBe(1);
    });

    it("should have no streak and an at risk today for a user with no days", () => {
      const result = streakOn([], "2026-01-08", "2026-01-08T09:00:00Z");

      expect(result).toMatchObject({ current: 0, longest: 0, today: "at_risk" });
    });
  });

  describe("settling a missed day", () => {
    const run = completeRun("2026-01-05", 3);

    it("should keep the streak at 11:59 the next day, because yesterday can still be completed", () => {
      const result = streakOn(run, "2026-01-09", "2026-01-09T11:59:00Z");

      expect(result.current).toBe(3);
      expect(result.yesterdayCompletable).toBe(true);
    });

    it("should reset the streak at 12:00 the next day", () => {
      const result = streakOn(run, "2026-01-09", "2026-01-09T12:00:00Z");

      expect(result.current).toBe(0);
      expect(result.yesterdayCompletable).toBe(false);
    });

    it("should keep the longest streak after a reset", () => {
      const days = [...completeRun("2026-01-01", 5), ...completeRun("2026-01-07", 2)];
      const result = streakOn(days, "2026-01-09", "2026-01-09T20:00:00Z");

      expect(result.current).toBe(2);
      expect(result.longest).toBe(5);
    });

    it("should count yesterday when it is completed before 12:00 today", () => {
      const finishedLate: StreakDay[] = [
        ...run,
        { ...completeDay("2026-01-08"), completedAt: "2026-01-09T09:15:00+00:00" },
      ];
      const result = streakOn(finishedLate, "2026-01-09", "2026-01-09T09:30:00Z");

      expect(result.current).toBe(4);
      expect(result.yesterdayCompletable).toBe(false);
    });

    it("should not count a day that was undone and completed again after 12:00 the next day", () => {
      const redone: StreakDay = {
        ...completeDay("2026-01-08"),
        completedAt: "2026-01-09T14:00:00+00:00",
      };
      const result = streakOn([...run, redone], "2026-01-09", "2026-01-09T15:00:00Z");

      expect(result.current).toBe(0);
    });

    it("should not bridge a day still open before noon when today is already complete", () => {
      const days = [...completeRun("2026-01-05", 2), completeDay("2026-01-08", "09:00")];
      const result = streakOn(days, "2026-01-08", "2026-01-08T09:30:00Z");

      expect(result.current).toBe(1);
    });

    it("should ignore a day with no entries even when it is marked complete", () => {
      const empty: StreakDay = { ...completeDay("2026-01-08"), entryCount: 0 };
      const result = streakOn([...run, empty], "2026-01-09", "2026-01-09T12:00:00Z");

      expect(result.current).toBe(0);
    });
  });

  describe("yesterday before any counted day", () => {
    const range = { from: "2026-01-09", to: "2026-01-10" };
    const readOn = (days: StreakDay[], now: string) =>
      dailyStreak(days, [], "2026-01-10", new Date(now), LONDON, range);

    it("should leave yesterday completable before 12:00 for an empty history", () => {
      const result = readOn([], "2026-01-10T09:00:00Z");

      expect(result.yesterdayCompletable).toBe(true);
      expect(result.calendar[0]).toEqual({ localDate: "2026-01-09", state: "at_risk" });
    });

    it("should settle yesterday as missed at 12:00 for an empty history", () => {
      const result = readOn([], "2026-01-10T12:00:00Z");

      expect(result.yesterdayCompletable).toBe(false);
      expect(result.calendar[0]).toEqual({ localDate: "2026-01-09", state: "missed" });
      expect(result.current).toBe(0);
    });

    it("should leave yesterday completable before 12:00 when the first counted day is today", () => {
      const result = readOn([completeDay("2026-01-10", "08:00")], "2026-01-10T09:00:00Z");

      expect(result.yesterdayCompletable).toBe(true);
      expect(result.calendar[0]).toEqual({ localDate: "2026-01-09", state: "at_risk" });
      expect(result.current).toBe(1);
    });

    it("should settle yesterday as missed at 12:00 when the first counted day is today", () => {
      const result = readOn([completeDay("2026-01-10", "08:00")], "2026-01-10T12:00:00Z");

      expect(result.yesterdayCompletable).toBe(false);
      expect(result.calendar[0]).toEqual({ localDate: "2026-01-09", state: "missed" });
      expect(result.current).toBe(1);
    });
  });

  describe("the zone", () => {
    it("should keep a streak across a zone change, because days follow their local date", () => {
      // Completed in London, read from New York the next morning: 09:00 there is 14:00 UTC.
      const days = [...completeRun("2026-01-05", 2), completeDay("2026-01-07", "23:30")];
      const result = streakOn(days, "2026-01-08", "2026-01-08T14:00:00Z", "America/New_York");

      expect(result.current).toBe(3);
      expect(result.today).toBe("at_risk");
    });
  });

  describe("across the clocks going forward in London", () => {
    // British Summer Time starts at 01:00 UTC on Sunday 29 March 2026, so 29 March is 23 hours long.
    const beforeChange = [
      completeDay("2026-03-27", "21:00"),
      { ...completeDay("2026-03-28"), completedAt: "2026-03-28T22:00:00+00:00" },
    ];

    it("should count the 23 hour day completed at 11:59 the next morning", () => {
      const days = [
        ...beforeChange,
        { ...completeDay("2026-03-29"), completedAt: "2026-03-30T11:59:00+01:00" },
      ];
      const result = streakOn(days, "2026-03-30", "2026-03-30T12:00:00+01:00");

      expect(result.current).toBe(3);
    });

    it("should not count it at 12:00 British Summer Time, which is 11:00 UTC", () => {
      const days = [
        ...beforeChange,
        { ...completeDay("2026-03-29"), completedAt: "2026-03-30T12:00:00+01:00" },
      ];
      const result = streakOn(days, "2026-03-30", "2026-03-30T13:00:00+01:00");

      expect(result.current).toBe(0);
      expect(result.longest).toBe(2);
    });

    it("should run a week over the change without breaking it", () => {
      const week = Array.from({ length: 7 }, (_, offset) => {
        const localDate = `2026-03-${String(25 + offset).padStart(2, "0")}`;
        const offsetText = offset < 4 ? "+00:00" : "+01:00";
        return { ...completeDay(localDate), completedAt: `${localDate}T20:30:00${offsetText}` };
      });
      const result = streakOn(week, "2026-03-31", "2026-03-31T21:00:00+01:00");

      expect(result.current).toBe(7);
      expect(result.today).toBe("complete");
    });
  });

  describe("calendar", () => {
    it("should mark complete, missed, at risk and future days", () => {
      const days = [completeDay("2026-01-05"), completeDay("2026-01-07")];
      const result = dailyStreak(days, [], "2026-01-09", new Date("2026-01-09T09:00:00Z"), LONDON, {
        from: "2026-01-05",
        to: "2026-01-10",
      });

      expect(result.calendar).toEqual([
        { localDate: "2026-01-05", state: "complete" },
        { localDate: "2026-01-06", state: "missed" },
        { localDate: "2026-01-07", state: "complete" },
        { localDate: "2026-01-08", state: "at_risk" },
        { localDate: "2026-01-09", state: "at_risk" },
        { localDate: "2026-01-10", state: "future" },
      ]);
    });

    it("should mark yesterday missed once 12:00 has passed", () => {
      const result = dailyStreak(
        [completeDay("2026-01-07")],
        [],
        "2026-01-09",
        new Date("2026-01-09T12:00:00Z"),
        LONDON,
        { from: "2026-01-08", to: "2026-01-09" },
      );

      expect(result.calendar).toEqual([
        { localDate: "2026-01-08", state: "missed" },
        { localDate: "2026-01-09", state: "at_risk" },
      ]);
    });

    it("should be empty when no range is asked for", () => {
      expect(streakOn([], "2026-01-09", "2026-01-09T09:00:00Z").calendar).toEqual([]);
    });
  });
});
