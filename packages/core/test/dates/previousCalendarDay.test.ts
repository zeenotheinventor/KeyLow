import { describe, expect, it } from "vitest";

import { clockHourOf, previousCalendarDay } from "../../src/dates";

describe("previousCalendarDay", () => {
  it("should step back one day", () => {
    expect(previousCalendarDay("2026-10-15")).toBe("2026-10-14");
  });

  it("should cross a month, a year and a leap day", () => {
    expect(previousCalendarDay("2026-11-01")).toBe("2026-10-31");
    expect(previousCalendarDay("2026-01-01")).toBe("2025-12-31");
    expect(previousCalendarDay("2028-03-01")).toBe("2028-02-29");
  });
});

describe("clockHourOf", () => {
  it("should read the hour in the given zone", () => {
    const instant = new Date("2026-10-15T10:20:00Z");

    expect(clockHourOf(instant, "UTC")).toBe(10);
    expect(clockHourOf(instant, "Europe/London")).toBe(11);
  });

  it("should read midnight as 0", () => {
    expect(clockHourOf(new Date("2026-10-14T23:05:00Z"), "Europe/London")).toBe(0);
  });
});
