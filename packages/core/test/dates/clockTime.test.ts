import { describe, expect, it } from "vitest";

import { joinClockTime, parseClockTime } from "../../src/dates";

describe("parseClockTime", () => {
  it("should read the hour and the minute of a 24-hour time", () => {
    expect(parseClockTime("12:40")).toEqual({ hour: 12, minute: 40 });
    expect(parseClockTime("00:00")).toEqual({ hour: 0, minute: 0 });
    expect(parseClockTime("23:59")).toEqual({ hour: 23, minute: 59 });
    expect(parseClockTime("08:05")).toEqual({ hour: 8, minute: 5 });
  });

  it.each([
    "",
    "12",
    "12:4",
    "1:40",
    "24:00",
    "12:60",
    "12:40:00",
    "ab:cd",
    " 12:40",
    "12.40",
    "-1:00",
  ])("should read %j as no time at all", (text) => {
    expect(parseClockTime(text)).toBeUndefined();
  });
});

describe("joinClockTime", () => {
  it("should write the hour and the minute with two digits each", () => {
    expect(joinClockTime(12, 40)).toBe("12:40");
    expect(joinClockTime(0, 0)).toBe("00:00");
    expect(joinClockTime(8, 5)).toBe("08:05");
    expect(joinClockTime(23, 59)).toBe("23:59");
  });

  it("should read back what parseClockTime read", () => {
    const parsed = parseClockTime("07:09");

    expect(parsed && joinClockTime(parsed.hour, parsed.minute)).toBe("07:09");
  });
});
