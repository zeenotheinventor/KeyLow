import { describe, expect, it } from "vitest";

import { addCalendarDays, daysSinceMonday } from "../../src/dates/calendarDay";

describe("addCalendarDays", () => {
  it("should add days within a month", () => {
    expect(addCalendarDays("2026-10-15", 3)).toBe("2026-10-18");
  });

  it("should cross a month end forwards and backwards", () => {
    expect(addCalendarDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addCalendarDays("2026-11-02", -3)).toBe("2026-10-30");
  });

  it("should cross a year end and a leap day", () => {
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCalendarDays("2028-02-28", 2)).toBe("2028-03-01");
  });

  it("should not move on zero", () => {
    expect(addCalendarDays("2026-10-15", 0)).toBe("2026-10-15");
  });
});

describe("daysSinceMonday", () => {
  it.each([
    ["2026-10-12", 0],
    ["2026-10-15", 3],
    ["2026-10-18", 6],
  ])("should count %s as %i days since Monday", (localDate, expected) => {
    expect(daysSinceMonday(localDate)).toBe(expected);
  });
});
