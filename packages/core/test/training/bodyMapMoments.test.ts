import { describe, expect, it } from "vitest";

import { loggedSets, params, week } from "./goldenWeekInputs";
import { dayMoments, heatValues, muscleState, projectedState } from "../../src/training";

const LONDON = "Europe/London";

const THURSDAY_1755 = "2026-10-15T17:55:00+01:00";

describe("dayMoments", () => {
  describe("the moment each day shows", () => {
    it("should show 20:00 local on each day but today, and now on today", () => {
      const { days } = dayMoments({ weekStart: "2026-10-12", tz: LONDON, now: THURSDAY_1755 });

      expect(days.map(({ date, at }) => [date, at])).toStrictEqual([
        ["2026-10-12", "2026-10-12T19:00:00.000Z"],
        ["2026-10-13", "2026-10-13T19:00:00.000Z"],
        ["2026-10-14", "2026-10-14T19:00:00.000Z"],
        ["2026-10-15", "2026-10-15T16:55:00.000Z"],
        ["2026-10-16", "2026-10-16T19:00:00.000Z"],
        ["2026-10-17", "2026-10-17T19:00:00.000Z"],
        ["2026-10-18", "2026-10-18T19:00:00.000Z"],
      ]);
    });

    it("should mark only today", () => {
      const { days } = dayMoments({ weekStart: "2026-10-12", tz: LONDON, now: THURSDAY_1755 });

      expect(days.filter(({ isToday }) => isToday).map(({ date }) => date)).toStrictEqual([
        "2026-10-15",
      ]);
    });

    it("should give 20:00 GMT on Sunday 25 October, the day the clocks go back, and 20:00 BST before it", () => {
      const { days } = dayMoments({ weekStart: "2026-10-19", tz: LONDON, now: THURSDAY_1755 });

      expect(days.map(({ at }) => at)).toStrictEqual([
        "2026-10-19T19:00:00.000Z",
        "2026-10-20T19:00:00.000Z",
        "2026-10-21T19:00:00.000Z",
        "2026-10-22T19:00:00.000Z",
        "2026-10-23T19:00:00.000Z",
        "2026-10-24T19:00:00.000Z",
        "2026-10-25T20:00:00.000Z",
      ]);
    });

    it("should give 20:00 BST on Sunday 29 March, the day the clocks go forward, and 20:00 GMT before it", () => {
      const { days } = dayMoments({ weekStart: "2026-03-23", tz: LONDON, now: THURSDAY_1755 });

      expect(days.map(({ at }) => at)).toStrictEqual([
        "2026-03-23T20:00:00.000Z",
        "2026-03-24T20:00:00.000Z",
        "2026-03-25T20:00:00.000Z",
        "2026-03-26T20:00:00.000Z",
        "2026-03-27T20:00:00.000Z",
        "2026-03-28T20:00:00.000Z",
        "2026-03-29T19:00:00.000Z",
      ]);
    });

    it.each([
      ["America/Los_Angeles", "2026-10-13T03:00:00.000Z"],
      ["Pacific/Auckland", "2026-10-12T07:00:00.000Z"],
      ["Asia/Kolkata", "2026-10-12T14:30:00.000Z"],
    ])("should read 20:00 in %s, not at one UTC hour", (tz, mondayAt) => {
      const { days } = dayMoments({ weekStart: "2026-10-12", tz, now: THURSDAY_1755 });

      expect(days[0]?.at).toBe(mondayAt);
    });

    it("should take today from the zone, so just after midnight in London is the next day", () => {
      // 23:30 UTC on Sunday 18 October is 00:30 BST on Monday 19 October.
      const now = "2026-10-18T23:30:00Z";

      const { days } = dayMoments({ weekStart: "2026-10-19", tz: LONDON, now });

      expect(days[0]).toMatchObject({
        date: "2026-10-19",
        at: "2026-10-18T23:30:00.000Z",
        isToday: true,
      });
    });
  });

  describe("which days can be picked", () => {
    it("should disable the days after today in Actual and none in Projected", () => {
      const { days } = dayMoments({ weekStart: "2026-10-12", tz: LONDON, now: THURSDAY_1755 });

      expect(days.map(({ selectable }) => selectable.actual)).toStrictEqual([
        true,
        true,
        true,
        true,
        false,
        false,
        false,
      ]);
      expect(days.every(({ selectable }) => selectable.projected)).toBe(true);
    });

    it("should let every day of a past week be picked in Actual", () => {
      const { days } = dayMoments({ weekStart: "2026-10-05", tz: LONDON, now: THURSDAY_1755 });

      expect(days.every(({ selectable }) => selectable.actual)).toBe(true);
    });

    it("should let no day of a future week be picked in Actual, and all in Projected", () => {
      const { days } = dayMoments({ weekStart: "2026-10-19", tz: LONDON, now: THURSDAY_1755 });

      expect(days.some(({ selectable }) => selectable.actual)).toBe(false);
      expect(days.every(({ selectable }) => selectable.projected)).toBe(true);
    });
  });

  describe("todayProjectedIsActual", () => {
    it("should be true when today is in the week, where Projected on today reads what is logged", () => {
      expect(
        dayMoments({ weekStart: "2026-10-12", tz: LONDON, now: THURSDAY_1755 })
          .todayProjectedIsActual,
      ).toBe(true);
    });

    it.each(["2026-10-05", "2026-10-19"])("should be false for the week of %s", (weekStart) => {
      expect(dayMoments({ weekStart, tz: LONDON, now: THURSDAY_1755 }).todayProjectedIsActual).toBe(
        false,
      );
    });
  });

  describe("the rules it refuses", () => {
    it("should refuse a week that does not start on a Monday", () => {
      expect(() => dayMoments({ weekStart: "2026-10-13", tz: LONDON, now: THURSDAY_1755 })).toThrow(
        new RangeError("A week must start on a Monday, written YYYY-MM-DD"),
      );
    });

    it("should refuse a time zone that is not an IANA name", () => {
      expect(() =>
        dayMoments({ weekStart: "2026-10-12", tz: "Not/AZone", now: THURSDAY_1755 }),
      ).toThrow(RangeError);
    });

    it("should refuse a moment without a zone", () => {
      expect(() =>
        dayMoments({ weekStart: "2026-10-12", tz: LONDON, now: "2026-10-15T17:55:00" }),
      ).toThrow(new RangeError("The moment to compute at must be an ISO timestamp with a zone"));
    });
  });

  describe("read by both views on the golden week", () => {
    const moments = dayMoments({
      weekStart: "2026-10-12",
      tz: LONDON,
      now: "2026-10-15T19:00:00+01:00",
    });
    const momentOn = (date: string): string => {
      const found = moments.days.find((day) => day.date === date);
      if (found === undefined) {
        throw new Error("The week holds every day of its seven");
      }
      return found.at;
    };

    it("should read Actual heat on Tuesday evening at that day's moment", () => {
      const states = muscleState(loggedSets, momentOn("2026-10-13"), params.training);

      expect(heatValues(states).lats).toBe(5);
      expect(heatValues(states).glute_max).toBe(0);
    });

    it("should read Projected heat on Sunday evening with Saturday's planned Push counted", () => {
      const states = projectedState(week.projected, momentOn("2026-10-18"), LONDON, params);

      expect(heatValues(states).chest_upper).toBe(2);
      expect(
        heatValues(muscleState(loggedSets, momentOn("2026-10-18"), params.training)).chest_upper,
      ).toBe(0);
    });

    it("should read the same Actual and Projected heat on today", () => {
      const at = momentOn("2026-10-15");

      expect(heatValues(projectedState(week.projected, at, LONDON, params))).toStrictEqual(
        heatValues(muscleState(loggedSets, at, params.training)),
      );
    });
  });
});
