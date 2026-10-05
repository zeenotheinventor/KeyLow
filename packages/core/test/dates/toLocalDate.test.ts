import { describe, expect, it } from "vitest";

import { toLocalDate } from "../../src/dates";

describe("toLocalDate", () => {
  it("should return the UTC calendar date when the time zone is UTC", () => {
    expect(toLocalDate(new Date("2026-06-15T12:00:00Z"), "UTC")).toBe("2026-06-15");
  });

  it("should return the next day when the local zone is ahead of UTC across midnight", () => {
    // 23:30 UTC on 29 March is 00:30 on 30 March in London, which is on BST (UTC+1) from 01:00 UTC that day.
    expect(toLocalDate(new Date("2026-03-29T23:30:00Z"), "Europe/London")).toBe("2026-03-30");
  });

  it("should return the previous day when the local zone is behind UTC across midnight", () => {
    expect(toLocalDate(new Date("2026-01-01T03:00:00Z"), "America/Los_Angeles")).toBe("2025-12-31");
  });

  it("should return the local date at the start of the clock change day in London", () => {
    expect(toLocalDate(new Date("2026-03-29T00:30:00Z"), "Europe/London")).toBe("2026-03-29");
  });

  it("should pad single digit months and days with a leading zero", () => {
    expect(toLocalDate(new Date("2026-02-03T12:00:00Z"), "UTC")).toBe("2026-02-03");
  });

  it("should throw a RangeError naming the time zone when it is not a valid IANA time zone", () => {
    expect(() => toLocalDate(new Date("2026-06-15T12:00:00Z"), "Not/AZone")).toThrow(
      new RangeError('Invalid time zone: "Not/AZone"'),
    );
  });

  it("should keep the original Intl error as the cause when the time zone is invalid", () => {
    let thrown: unknown;
    try {
      toLocalDate(new Date("2026-06-15T12:00:00Z"), "Not/AZone");
    } catch (error) {
      thrown = error;
    }

    expect(thrown instanceof RangeError && thrown.cause instanceof RangeError).toBe(true);
  });

  it("should throw a RangeError when the instant is an invalid Date", () => {
    expect(() => toLocalDate(new Date("not a date"), "UTC")).toThrow(
      new RangeError("Invalid instant: the Date has no valid time value"),
    );
  });
});
