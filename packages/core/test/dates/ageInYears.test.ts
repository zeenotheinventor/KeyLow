import { describe, expect, it } from "vitest";

import { ageInYears } from "../../src/dates";

describe("ageInYears", () => {
  it.each([
    ["the day before the 13th birthday", "2013-10-24", "2026-10-23", 12],
    ["the 13th birthday itself", "2013-10-23", "2026-10-23", 13],
    ["the day after the 13th birthday", "2013-10-22", "2026-10-23", 13],
    ["a month later in the year than the birthday", "2013-01-31", "2026-10-23", 13],
    ["a month earlier in the year than the birthday", "2013-12-01", "2026-10-23", 12],
    ["the day it was born", "2026-10-23", "2026-10-23", 0],
    ["a hundred years and a day", "1926-10-22", "2026-10-23", 100],
    ["the day before the 101st birthday", "1925-10-24", "2026-10-23", 100],
  ])("should count %s", (_name, birthDate, onDate, years) => {
    expect(ageInYears(birthDate, onDate)).toBe(years);
  });

  describe("a 29 February birthday", () => {
    it("should not count the birthday on 27 February of a year with no 29 February", () => {
      expect(ageInYears("2000-02-29", "2026-02-27")).toBe(25);
    });

    it("should count the birthday on 28 February of a year with no 29 February", () => {
      expect(ageInYears("2000-02-29", "2026-02-28")).toBe(26);
    });

    it("should count the birthday on 29 February of a leap year", () => {
      expect(ageInYears("2000-02-29", "2028-02-29")).toBe(28);
    });

    it("should not count the birthday on 28 February of a leap year", () => {
      expect(ageInYears("2000-02-29", "2028-02-28")).toBe(27);
    });

    it("should count the birthday on 1 March of a year with no 29 February", () => {
      expect(ageInYears("2000-02-29", "2026-03-01")).toBe(26);
    });
  });

  it("should be negative before the birth date", () => {
    expect(ageInYears("2026-12-01", "2026-10-23")).toBe(-1);
  });

  it("should refuse a birth date that is not a day, without quoting it", () => {
    expect(() => ageInYears("2026-02-30", "2026-10-23")).toThrow(
      new RangeError("Not a calendar date"),
    );
  });
});
