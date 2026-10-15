import { describe, expect, it } from "vitest";

import { addMonths, monthOf, monthWeeks } from "../../src/dates";

describe("monthOf", () => {
  it("should name the month a day is in", () => {
    expect(monthOf("2026-10-15")).toBe("2026-10");
  });
});

describe("addMonths", () => {
  it("should step forward and back by whole months", () => {
    expect(addMonths("2026-10-15", 1)).toBe("2026-11-15");
    expect(addMonths("2026-10-15", -1)).toBe("2026-09-15");
  });

  it("should cross a year", () => {
    expect(addMonths("2026-12-10", 1)).toBe("2027-01-10");
    expect(addMonths("2026-01-10", -1)).toBe("2025-12-10");
  });

  it("should keep to the last day of a shorter month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });
});

describe("monthWeeks", () => {
  it("should lay October 2026 out in Monday first weeks, padded with nulls", () => {
    const weeks = monthWeeks("2026-10");

    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([
      null,
      null,
      null,
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(weeks[4]).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      null,
    ]);
  });

  it("should start a month that begins on a Monday with no padding", () => {
    expect(monthWeeks("2026-06")[0]?.[0]).toBe("2026-06-01");
  });

  it("should draw February 2027, which fills four weeks exactly, as four weeks", () => {
    expect(monthWeeks("2027-02")).toHaveLength(4);
  });

  it("should give every week seven cells and hold every day of the month once", () => {
    for (const month of ["2026-02", "2028-02", "2026-08", "2026-12"]) {
      const weeks = monthWeeks(month);
      const days = weeks.flat().filter((day) => day !== null);

      expect(weeks.every((week) => week.length === 7)).toBe(true);
      expect(new Set(days).size).toBe(days.length);
      expect(days[0]).toBe(`${month}-01`);
    }
    expect(monthWeeks("2028-02").flat().filter(Boolean)).toHaveLength(29);
  });
});
