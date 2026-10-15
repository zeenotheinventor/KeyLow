import { describe, expect, it } from "vitest";

import { nextWeek, previousWeek, weekOf, weekStripDays } from "../../../src/diary/rules";

const THURSDAY_15_OCTOBER = new Date("2026-10-15T11:40:00Z");

describe("weekOf", () => {
  it("should give Monday 12 to Sunday 18 October for Thursday 15 October", () => {
    expect(weekOf("2026-10-15")).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
  });

  it("should give the same week for its Monday and its Sunday", () => {
    expect(weekOf("2026-10-12")).toEqual(weekOf("2026-10-15"));
    expect(weekOf("2026-10-18")).toEqual(weekOf("2026-10-15"));
  });

  it("should cross a month end", () => {
    expect(weekOf("2026-10-29")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });

  it("should cross a year end", () => {
    const week = weekOf("2026-12-31");

    expect(week[0]).toBe("2026-12-28");
    expect(week[6]).toBe("2027-01-03");
  });
});

describe("previousWeek and nextWeek", () => {
  it("should move the week back seven days", () => {
    expect(previousWeek("2026-10-15")).toEqual(weekOf("2026-10-08"));
    expect(previousWeek("2026-10-15")[0]).toBe("2026-10-05");
  });

  it("should move the week forward seven days", () => {
    expect(nextWeek("2026-10-15")).toEqual(weekOf("2026-10-22"));
    expect(nextWeek("2026-10-15")[0]).toBe("2026-10-19");
  });

  it("should cross a month end", () => {
    expect(nextWeek("2026-10-29")[0]).toBe("2026-11-02");
    expect(previousWeek("2026-11-02")[6]).toBe("2026-11-01");
  });
});

describe("weekStripDays", () => {
  const noRows: { local_date: string; is_complete: boolean }[] = [];

  it("should mark Thursday as today and Friday to Sunday as future", () => {
    const days = weekStripDays(
      {
        weekOf: "2026-10-15",
        selectedDate: "2026-10-15",
        now: THURSDAY_15_OCTOBER,
        dayLogs: noRows,
      },
      "Europe/London",
    );

    expect(days.map((day) => day.localDate)).toEqual(weekOf("2026-10-15"));
    expect(days.map((day) => day.isToday)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
    expect(days.map((day) => day.isFuture)).toEqual([false, false, false, false, true, true, true]);
  });

  it("should select the selected date only", () => {
    const days = weekStripDays(
      {
        weekOf: "2026-10-15",
        selectedDate: "2026-10-14",
        now: THURSDAY_15_OCTOBER,
        dayLogs: noRows,
      },
      "Europe/London",
    );

    expect(days.map((day) => day.isSelected)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it("should select nothing when the selected date is in another week", () => {
    const days = weekStripDays(
      {
        weekOf: "2026-10-15",
        selectedDate: "2026-10-08",
        now: THURSDAY_15_OCTOBER,
        dayLogs: noRows,
      },
      "Europe/London",
    );

    expect(days.some((day) => day.isSelected)).toBe(false);
  });

  it("should call a day complete only when day_logs says so, and a day with no row not complete", () => {
    const dayLogs = [
      { local_date: "2026-10-12", is_complete: true },
      { local_date: "2026-10-13", is_complete: true },
      { local_date: "2026-10-14", is_complete: false },
      { local_date: "2026-10-05", is_complete: true },
    ];

    const days = weekStripDays(
      { weekOf: "2026-10-15", selectedDate: "2026-10-15", now: THURSDAY_15_OCTOBER, dayLogs },
      "Europe/London",
    );

    expect(days.map((day) => day.isComplete)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("should read today in the zone, not in UTC", () => {
    // 23:30 UTC on 15 October is already Friday 16 October in London.
    const days = weekStripDays(
      {
        weekOf: "2026-10-15",
        selectedDate: "2026-10-16",
        now: new Date("2026-10-15T23:30:00Z"),
        dayLogs: noRows,
      },
      "Europe/London",
    );

    expect(days.map((day) => day.isToday)).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
      false,
    ]);
  });

  it("should call every day past when the week is before today, and none future", () => {
    const days = weekStripDays(
      {
        weekOf: "2026-10-08",
        selectedDate: "2026-10-08",
        now: THURSDAY_15_OCTOBER,
        dayLogs: noRows,
      },
      "Europe/London",
    );

    expect(days.every((day) => !day.isFuture && !day.isToday)).toBe(true);
  });

  it("should call every day future when the week is after today", () => {
    const days = weekStripDays(
      {
        weekOf: "2026-10-22",
        selectedDate: "2026-10-15",
        now: THURSDAY_15_OCTOBER,
        dayLogs: noRows,
      },
      "Europe/London",
    );

    expect(days.every((day) => day.isFuture)).toBe(true);
  });

  it("should throw a RangeError for a zone that is not a valid IANA zone", () => {
    expect(() =>
      weekStripDays(
        {
          weekOf: "2026-10-15",
          selectedDate: "2026-10-15",
          now: THURSDAY_15_OCTOBER,
          dayLogs: noRows,
        },
        "Not/AZone",
      ),
    ).toThrow(RangeError);
  });
});
