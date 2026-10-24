import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  checkinWeekday,
  dueCheckinDates,
  firstCheckinDate,
  localToday,
  nextAfter,
  scheduleToSet,
} from "../../src/engine";

/*
 * Every expected date and weekday below is a literal worked out from a calendar. The properties compute
 * their weekday and day count with `Date` and plain arithmetic, not with the module under test.
 */

describe("firstCheckinDate (ADR 0002, Amendment 2, 'The schedule')", () => {
  it("should be 14 days after the day the schedule is set", () => {
    expect(firstCheckinDate("2026-10-22")).toBe("2026-11-05");
  });

  it("should cross a year end", () => {
    expect(firstCheckinDate("2026-12-20")).toBe("2027-01-03");
  });

  it("should count 29 February in a leap year", () => {
    expect(firstCheckinDate("2024-02-20")).toBe("2024-03-05");
  });
});

describe("checkinWeekday", () => {
  it.each([
    ["Monday", "2026-10-26", 1],
    ["Thursday", "2026-10-22", 4],
    ["Saturday", "2026-02-28", 6],
    ["Sunday", "2026-11-01", 7],
  ])("should be the ISO number of a %s (%s)", (_name, startedOn, weekday) => {
    expect(checkinWeekday(startedOn)).toBe(weekday);
  });

  it("should be the weekday of the first check-in too", () => {
    expect(checkinWeekday(firstCheckinDate("2026-10-22"))).toBe(4);
  });
});

describe("dueCheckinDates", () => {
  it("should list every weekly date up to today, oldest first (Thursday start, 2026-11-26)", () => {
    expect(dueCheckinDates("2026-11-05", "2026-11-26")).toStrictEqual([
      "2026-11-05",
      "2026-11-12",
      "2026-11-19",
      "2026-11-26",
    ]);
  });

  it("should list nothing the day before the first check-in", () => {
    expect(dueCheckinDates("2026-11-05", "2026-11-04")).toStrictEqual([]);
  });

  it("should list the date on the day itself", () => {
    expect(dueCheckinDates("2026-11-05", "2026-11-05")).toStrictEqual(["2026-11-05"]);
  });

  it("should list one date a missed week and no more (Q2)", () => {
    expect(dueCheckinDates("2026-11-05", "2026-11-18")).toStrictEqual(["2026-11-05", "2026-11-12"]);
  });

  it("should not list the next week's date one day early", () => {
    expect(dueCheckinDates("2026-11-05", "2026-11-11")).toStrictEqual(["2026-11-05"]);
  });

  it("should cross a month and a year end in steps of 7 days", () => {
    expect(dueCheckinDates("2026-12-17", "2027-01-08")).toStrictEqual([
      "2026-12-17",
      "2026-12-24",
      "2026-12-31",
      "2027-01-07",
    ]);
  });
});

describe("nextAfter", () => {
  it("should be 7 days after the check-in", () => {
    expect(nextAfter("2026-11-05")).toBe("2026-11-12");
  });

  it("should cross a month end", () => {
    expect(nextAfter("2026-11-26")).toBe("2026-12-03");
  });
});

describe("localToday", () => {
  it.each([
    ["Europe/London in BST, ahead of UTC", "2026-10-23T23:30:00Z", "Europe/London", "2026-10-24"],
    [
      "America/Los_Angeles, behind UTC",
      "2026-10-23T23:30:00Z",
      "America/Los_Angeles",
      "2026-10-23",
    ],
    ["Europe/London in GMT, level with UTC", "2026-11-02T23:30:00Z", "Europe/London", "2026-11-02"],
    [
      "Pacific/Auckland, far ahead of UTC",
      "2026-11-02T23:30:00Z",
      "Pacific/Auckland",
      "2026-11-03",
    ],
  ])("should read %s", (_name, nowIso, timeZone, expected) => {
    expect(localToday(nowIso, timeZone)).toBe(expected);
  });

  it("should give the UTC date when the zone is null", () => {
    expect(localToday("2026-10-23T23:30:00Z", null)).toBe("2026-10-23");
  });

  it("should read a name that is not an IANA zone as UTC", () => {
    expect(localToday("2026-10-23T23:30:00Z", "Not/AZone")).toBe("2026-10-23");
  });

  it("should throw a RangeError, with no value in the message, for a time that is not a date", () => {
    expect(() => localToday("not a time", "Europe/London")).toThrow(RangeError);
    expect(() => localToday("not a time", "Europe/London")).toThrow(/^[^0-9]*$/);
  });
});

describe("scheduleToSet", () => {
  it("should give the first check-in and its weekday when there is no next date (set up on Thursday 2026-10-22)", () => {
    expect(scheduleToSet({ next_checkin_date: null }, "2026-10-22")).toStrictEqual({
      nextCheckinDate: "2026-11-05",
      checkinWeekday: 4,
    });
  });

  it("should give nothing when the program already has a next date", () => {
    expect(scheduleToSet({ next_checkin_date: "2026-11-12" }, "2026-10-22")).toBeNull();
  });

  it("should give nothing for a next date that has already passed, because the schedule does not move", () => {
    expect(scheduleToSet({ next_checkin_date: "2026-10-01" }, "2026-10-22")).toBeNull();
  });
});

describe("schedule properties", () => {
  /** Whole days from 2020-01-01 to 2035-12-31, so every case is a real calendar day. */
  const startDates = fc
    .date({
      min: new Date("2020-01-01T00:00:00Z"),
      max: new Date("2035-12-31T00:00:00Z"),
      noInvalidDate: true,
    })
    .map((date) => date.toISOString().slice(0, 10));
  const daysSinceStart = fc.integer({ min: 0, max: 400 });

  const isoWeekdayOf = (calendarDate: string): number => {
    const day = new Date(`${calendarDate}T00:00:00Z`).getUTCDay();
    return day === 0 ? 7 : day;
  };
  const dayAfter = (calendarDate: string, days: number): string =>
    new Date(Date.parse(`${calendarDate}T00:00:00Z`) + days * 86_400_000)
      .toISOString()
      .slice(0, 10);

  it("should put every due date on the weekday the user set up", () => {
    fc.assert(
      fc.property(startDates, daysSinceStart, (startedOn, elapsed) => {
        const due = dueCheckinDates(firstCheckinDate(startedOn), dayAfter(startedOn, elapsed));

        expect(due.every((date) => isoWeekdayOf(date) === checkinWeekday(startedOn))).toBe(true);
        expect(checkinWeekday(startedOn)).toBe(isoWeekdayOf(startedOn));
      }),
    );
  });

  it("should never list a date after today", () => {
    fc.assert(
      fc.property(startDates, daysSinceStart, (startedOn, elapsed) => {
        const today = dayAfter(startedOn, elapsed);
        const due = dueCheckinDates(firstCheckinDate(startedOn), today);

        expect(due.every((date) => date <= today)).toBe(true);
      }),
    );
  });

  it("should list exactly one date for each whole week since the first check-in, 7 days apart", () => {
    fc.assert(
      fc.property(startDates, daysSinceStart, (startedOn, elapsed) => {
        const first = firstCheckinDate(startedOn);
        const due = dueCheckinDates(first, dayAfter(startedOn, elapsed));
        const expectedCount = elapsed < 14 ? 0 : Math.floor((elapsed - 14) / 7) + 1;

        expect(due).toHaveLength(expectedCount);
        expect(due).toStrictEqual(
          Array.from({ length: expectedCount }, (_, week) => dayAfter(first, 7 * week)),
        );
      }),
    );
  });
});
