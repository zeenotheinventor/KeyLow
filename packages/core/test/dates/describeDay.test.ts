import { describe, expect, it } from "vitest";

import { describeDay, describeDiaryTitle } from "../../src/dates";

// Thursday 15 October 2026, midday in London (BST, UTC+1) and midday in UTC.
const today = new Date("2026-10-15T12:00:00Z");

describe("describeDay", () => {
  it("should call the same day Today and give its date as the sub line", () => {
    const day = describeDay(new Date("2026-10-15T07:30:00Z"), today, "UTC");

    expect(day.label).toBe("Today");
    expect(day.subLine).toBe("15 October");
  });

  it("should call the day before Yesterday and give its date as the sub line", () => {
    const day = describeDay(new Date("2026-10-14T12:00:00Z"), today, "UTC");

    expect(day.label).toBe("Yesterday");
    expect(day.subLine).toBe("14 October");
  });

  it("should call the day after Tomorrow and invite a change", () => {
    const day = describeDay(new Date("2026-10-16T12:00:00Z"), today, "UTC");

    expect(day.label).toBe("Tomorrow");
    expect(day.subLine).toBe("Tap to change");
  });

  it("should write an older day as a short en-GB date and invite a change", () => {
    const day = describeDay(new Date("2026-10-12T12:00:00Z"), today, "UTC");

    expect(day.label).toBe("Mon 12 Oct");
    expect(day.subLine).toBe("Tap to change");
  });

  it("should write a later day the same way", () => {
    expect(describeDay(new Date("2026-10-20T12:00:00Z"), today, "UTC").label).toBe("Tue 20 Oct");
  });

  it("should write September as Sep and not Sept", () => {
    expect(describeDay(new Date("2026-09-01T12:00:00Z"), today, "UTC").label).toBe("Tue 1 Sep");
  });

  it("should call 30 September Yesterday when today is 1 October", () => {
    const day = describeDay(
      new Date("2026-09-30T12:00:00Z"),
      new Date("2026-10-01T12:00:00Z"),
      "UTC",
    );

    expect(day.label).toBe("Yesterday");
    expect(day.subLine).toBe("30 September");
  });

  it("should call 31 December Yesterday when today is 1 January", () => {
    const day = describeDay(
      new Date("2025-12-31T12:00:00Z"),
      new Date("2026-01-01T12:00:00Z"),
      "UTC",
    );

    expect(day.label).toBe("Yesterday");
    expect(day.subLine).toBe("31 December");
  });

  it("should read the calendar day in the given time zone", () => {
    // 23:30 UTC on 14 October is 00:30 on 15 October in London (BST).
    const lateEvening = new Date("2026-10-14T23:30:00Z");

    expect(describeDay(lateEvening, today, "UTC").label).toBe("Yesterday");
    expect(describeDay(lateEvening, today, "Europe/London").label).toBe("Today");
  });

  it("should count the 25 hour day when the clocks go back as one day", () => {
    // London leaves BST at 01:00 UTC on Sunday 25 October 2026.
    const day = describeDay(
      new Date("2026-10-25T12:00:00Z"),
      new Date("2026-10-26T12:00:00Z"),
      "Europe/London",
    );

    expect(day.label).toBe("Yesterday");
  });

  it("should name the day and its date for the date picker button when the label is relative", () => {
    const day = describeDay(new Date("2026-10-14T12:00:00Z"), today, "UTC");

    expect(day.pickerName).toBe("Yesterday, 14 October. Choose a date");
  });

  it("should name only the label for the date picker button when the label is already a date", () => {
    const day = describeDay(new Date("2026-10-12T12:00:00Z"), today, "UTC");

    expect(day.pickerName).toBe("Mon 12 Oct. Choose a date");
  });

  it("should count the days from today, so a screen can stop stepping forward", () => {
    expect(describeDay(new Date("2026-10-12T12:00:00Z"), today, "UTC").daysFromToday).toBe(-3);
    expect(describeDay(new Date("2026-10-15T01:00:00Z"), today, "UTC").daysFromToday).toBe(0);
    expect(describeDay(new Date("2026-10-17T12:00:00Z"), today, "UTC").daysFromToday).toBe(2);
  });

  it("should throw a RangeError for an invalid date", () => {
    expect(() => describeDay(new Date("not a date"), today, "UTC")).toThrow(RangeError);
  });
});

describe("describeDiaryTitle", () => {
  it("should call today Today", () => {
    expect(describeDiaryTitle(new Date("2026-10-15T07:30:00Z"), today, "UTC")).toBe("Today");
  });

  it("should write yesterday as its date, as the past-day board does, and not as Yesterday", () => {
    expect(describeDiaryTitle(new Date("2026-10-14T12:00:00Z"), today, "UTC")).toBe("Wed 14 Oct");
  });

  it("should write any other day as a short date", () => {
    expect(describeDiaryTitle(new Date("2026-10-12T12:00:00Z"), today, "UTC")).toBe("Mon 12 Oct");
  });

  it("should read both days in the given zone", () => {
    // 23:30 UTC on the 14th is already the 15th in London, where it is BST.
    expect(describeDiaryTitle(new Date("2026-10-14T23:30:00Z"), today, "Europe/London")).toBe(
      "Today",
    );
  });
});
