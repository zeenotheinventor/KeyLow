import { describe, expect, it } from "vitest";

import { instantAtLocalTime } from "../../src/dates";

const atLondon = (localDate: string, hour: number, minute: number): string =>
  instantAtLocalTime(localDate, hour, minute, "Europe/London").toISOString();

describe("instantAtLocalTime", () => {
  it("should find the instant of a wall-clock time in British Summer Time", () => {
    expect(atLondon("2026-10-15", 8, 5)).toBe("2026-10-15T07:05:00.000Z");
  });

  it("should find the instant of a wall-clock time in Greenwich Mean Time", () => {
    expect(atLondon("2026-12-15", 8, 5)).toBe("2026-12-15T08:05:00.000Z");
  });

  it("should find the instant of midnight, the start of the day", () => {
    expect(atLondon("2026-10-15", 0, 0)).toBe("2026-10-14T23:00:00.000Z");
  });

  it("should follow the zone it is given", () => {
    expect(instantAtLocalTime("2026-10-15", 5, 30, "Asia/Kolkata").toISOString()).toBe(
      "2026-10-15T00:00:00.000Z",
    );
    expect(instantAtLocalTime("2026-10-15", 20, 0, "America/New_York").toISOString()).toBe(
      "2026-10-16T00:00:00.000Z",
    );
  });

  describe("in a gap, when the clocks go forward (London, 29 March 2026)", () => {
    it("should resolve 01:30, which does not exist, to 02:30 summer time", () => {
      expect(atLondon("2026-03-29", 1, 30)).toBe("2026-03-29T01:30:00.000Z");
    });

    it("should resolve 01:00 to 02:00 summer time", () => {
      expect(atLondon("2026-03-29", 1, 0)).toBe("2026-03-29T01:00:00.000Z");
    });

    it("should leave 00:59, just before the gap, alone", () => {
      expect(atLondon("2026-03-29", 0, 59)).toBe("2026-03-29T00:59:00.000Z");
    });

    it("should leave 02:00, the first time after the gap, alone", () => {
      expect(atLondon("2026-03-29", 2, 0)).toBe("2026-03-29T01:00:00.000Z");
    });
  });

  describe("in an overlap, when the clocks go back (London, 25 October 2026)", () => {
    it("should resolve 01:30, which happens twice, to the first time, in summer time", () => {
      expect(atLondon("2026-10-25", 1, 30)).toBe("2026-10-25T00:30:00.000Z");
    });

    it("should leave 02:00, the first time after the overlap, alone", () => {
      expect(atLondon("2026-10-25", 2, 0)).toBe("2026-10-25T02:00:00.000Z");
    });
  });

  it("should resolve a gap and an overlap the same way in New York", () => {
    // Gap on 8 March 2026: 02:30 does not exist. Overlap on 1 November 2026: 01:30 happens twice.
    expect(instantAtLocalTime("2026-03-08", 2, 30, "America/New_York").toISOString()).toBe(
      "2026-03-08T07:30:00.000Z",
    );
    expect(instantAtLocalTime("2026-11-01", 1, 30, "America/New_York").toISOString()).toBe(
      "2026-11-01T05:30:00.000Z",
    );
  });

  it.each([
    [
      "Auckland gap 2026-09-27 02:30 reads 03:30",
      "Pacific/Auckland",
      "2026-09-27",
      2,
      30,
      "2026-09-26T14:30:00.000Z",
    ],
    [
      "Auckland overlap 2026-04-05 02:30, first pass",
      "Pacific/Auckland",
      "2026-04-05",
      2,
      30,
      "2026-04-04T13:30:00.000Z",
    ],
    [
      "Los Angeles gap 2026-03-08 02:30 reads 03:30",
      "America/Los_Angeles",
      "2026-03-08",
      2,
      30,
      "2026-03-08T10:30:00.000Z",
    ],
    [
      "Los Angeles overlap 2026-11-01 01:30, first pass",
      "America/Los_Angeles",
      "2026-11-01",
      1,
      30,
      "2026-11-01T08:30:00.000Z",
    ],
  ])("should resolve %s the compatible way", (_name, zone, localDate, hour, minute, expected) => {
    expect(instantAtLocalTime(localDate, hour, minute, zone).toISOString()).toBe(expected);
  });

  it.each([-1, 24, 1.5, Number.NaN])("should reject the hour %s", (hour) => {
    expect(() => instantAtLocalTime("2026-10-15", hour, 0, "UTC")).toThrow(RangeError);
  });

  it.each([-1, 60, 0.5])("should reject the minute %s", (minute) => {
    expect(() => instantAtLocalTime("2026-10-15", 8, minute, "UTC")).toThrow(RangeError);
  });

  it("should throw a RangeError for a zone that is not a valid IANA zone", () => {
    expect(() => instantAtLocalTime("2026-10-15", 8, 5, "Not/AZone")).toThrow(
      new RangeError('Invalid time zone: "Not/AZone"'),
    );
  });
});
