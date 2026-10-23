import { describe, expect, it } from "vitest";

import { MAX_AGE_YEARS, MIN_AGE_YEARS, checkBirthDate } from "../../src/setup";

const TODAY = "2026-10-23";

describe("checkBirthDate", () => {
  it("should name the youngest and oldest ages as literals", () => {
    expect(MIN_AGE_YEARS).toBe(13);
    expect(MAX_AGE_YEARS).toBe(100);
  });

  it.each([["1990-04-15"], ["2013-10-23"], ["1926-10-23"], ["1926-10-22"]])(
    "should accept %s",
    (birthDate) => {
      expect(checkBirthDate(birthDate, TODAY)).toEqual({ ok: true });
    },
  );

  it("should refuse 12 years and 364 days as too young", () => {
    expect(checkBirthDate("2013-10-24", TODAY)).toEqual({ ok: false, reason: "too-young" });
  });

  it("should accept 13 years on the day", () => {
    expect(checkBirthDate("2013-10-23", TODAY)).toEqual({ ok: true });
  });

  it("should refuse someone born today as too young", () => {
    expect(checkBirthDate(TODAY, TODAY)).toEqual({ ok: false, reason: "too-young" });
  });

  it("should accept 100 years and 364 days", () => {
    expect(checkBirthDate("1925-10-24", TODAY)).toEqual({ ok: true });
  });

  it("should refuse 101 years on the day as too old", () => {
    expect(checkBirthDate("1925-10-23", TODAY)).toEqual({ ok: false, reason: "too-old" });
  });

  it("should refuse tomorrow as a future date", () => {
    expect(checkBirthDate("2026-10-24", TODAY)).toEqual({ ok: false, reason: "future" });
  });

  it("should refuse a date a year ahead as a future date", () => {
    expect(checkBirthDate("2027-10-23", TODAY)).toEqual({ ok: false, reason: "future" });
  });

  it.each([[""], ["2026-02-30"], ["15/04/1990"], ["1990-4-5"], ["not a date"]])(
    "should refuse %j as not a date",
    (text) => {
      expect(checkBirthDate(text, TODAY)).toEqual({ ok: false, reason: "not-a-date" });
    },
  );

  it("should accept a 29 February birth in a leap year", () => {
    expect(checkBirthDate("2000-02-29", TODAY)).toEqual({ ok: true });
  });
});
