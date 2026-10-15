import { afterEach, describe, expect, it, vi } from "vitest";

import { formatClockTime } from "../../src/dates";

const atLondon = (instant: string): string => formatClockTime(new Date(instant), "Europe/London");

describe("formatClockTime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("should write the 24-hour clock with two digits for the hour and the minute", () => {
    expect(formatClockTime(new Date("2026-12-15T08:05:59Z"), "UTC")).toBe("08:05");
    expect(formatClockTime(new Date("2026-12-15T23:59:00Z"), "UTC")).toBe("23:59");
  });

  it("should write midnight as 00:00", () => {
    expect(atLondon("2026-12-15T00:00:00Z")).toBe("00:00");
  });

  it("should use British Summer Time in October before the clocks go back", () => {
    expect(atLondon("2026-10-15T07:05:00Z")).toBe("08:05");
  });

  it("should use Greenwich Mean Time in winter", () => {
    expect(atLondon("2026-12-15T08:05:00Z")).toBe("08:05");
  });

  describe("on 29 March 2026, when the clocks go forward at 01:00 UTC", () => {
    it("should read 00:59 one minute before the change", () => {
      expect(atLondon("2026-03-29T00:59:00Z")).toBe("00:59");
    });

    it("should read 02:00 at the change, because 01:00 does not exist", () => {
      expect(atLondon("2026-03-29T01:00:00Z")).toBe("02:00");
    });

    it("should read 08:05 in the morning after", () => {
      expect(atLondon("2026-03-29T07:05:00Z")).toBe("08:05");
    });
  });

  describe("on 25 October 2026, when the clocks go back at 01:00 UTC", () => {
    it("should read 01:30 on the first pass, in British Summer Time", () => {
      expect(atLondon("2026-10-25T00:30:00Z")).toBe("01:30");
    });

    it("should read 01:30 again an hour later, in Greenwich Mean Time", () => {
      expect(atLondon("2026-10-25T01:30:00Z")).toBe("01:30");
    });

    it("should read 08:05 in the morning after", () => {
      expect(atLondon("2026-10-25T08:05:00Z")).toBe("08:05");
    });
  });

  it("should follow the zone it is given, including a half-hour offset", () => {
    expect(formatClockTime(new Date("2026-10-15T00:00:00Z"), "Asia/Kolkata")).toBe("05:30");
    expect(formatClockTime(new Date("2026-10-15T00:00:00Z"), "America/New_York")).toBe("20:00");
  });

  it("should read an engine that writes midnight as hour 24 as hour 00", () => {
    // Node never does this. The guard is for engines that might (Hermes is unverified).
    class MidnightAsHourTwentyFour {
      formatToParts() {
        return [
          { type: "year", value: "2026" },
          { type: "month", value: "10" },
          { type: "day", value: "15" },
          { type: "hour", value: "24" },
          { type: "minute", value: "05" },
        ];
      }
    }
    vi.stubGlobal("Intl", { DateTimeFormat: MidnightAsHourTwentyFour });

    // A zone no other test uses, so a formatter kept from an earlier test cannot stand in for the stub.
    expect(formatClockTime(new Date("2026-10-15T00:05:00Z"), "Stub/MidnightZone")).toBe("00:05");
  });

  it("should build one formatter per zone, however many times it is asked", () => {
    const build = vi.spyOn(Intl, "DateTimeFormat");

    formatClockTime(new Date("2026-10-15T07:05:00Z"), "Australia/Sydney");
    formatClockTime(new Date("2026-10-15T08:05:00Z"), "Australia/Sydney");
    formatClockTime(new Date("2026-10-15T09:05:00Z"), "Australia/Sydney");

    expect(build).toHaveBeenCalledTimes(1);
  });

  it("should not keep a zone that failed to build", () => {
    expect(() => formatClockTime(new Date("2026-10-15T07:05:00Z"), "Not/AZone")).toThrow(
      RangeError,
    );
    expect(() => formatClockTime(new Date("2026-10-15T07:05:00Z"), "Not/AZone")).toThrow(
      RangeError,
    );
  });

  it("should throw a RangeError naming the zone when it is not a valid IANA zone", () => {
    expect(() => formatClockTime(new Date("2026-10-15T07:05:00Z"), "Not/AZone")).toThrow(
      new RangeError('Invalid time zone: "Not/AZone"'),
    );
  });

  it("should throw a RangeError when the instant is not a valid time", () => {
    expect(() => formatClockTime(new Date(Number.NaN), "UTC")).toThrow(RangeError);
  });
});
