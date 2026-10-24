import { readBirthDate } from "../../components/SetupScreen/steps/BirthDateStep/readBirthDate";

const TODAY = "2026-10-23";

const read = (day: string, month: string, year: string) =>
  readBirthDate({ day, month, year }, TODAY);

describe("readBirthDate", () => {
  it("should say empty when no field has anything in it", () => {
    expect(read("", "", "")).toEqual({ kind: "empty" });
  });

  it("should read British order, day then month then year", () => {
    expect(read("14", "03", "1991")).toEqual({ kind: "valid", birthDate: "1991-03-14" });
  });

  it("should pad a one digit day and month", () => {
    expect(read("4", "3", "1991")).toEqual({ kind: "valid", birthDate: "1991-03-04" });
  });

  it("should accept someone who turns 13 today", () => {
    expect(read("23", "10", "2013")).toEqual({ kind: "valid", birthDate: "2013-10-23" });
  });

  it("should refuse someone who turns 13 tomorrow as too young", () => {
    expect(read("24", "10", "2013")).toEqual({ kind: "problem", reason: "too-young" });
  });

  it("should refuse a date in the future", () => {
    expect(read("12", "11", "2026")).toEqual({ kind: "problem", reason: "future" });
  });

  it("should refuse a birth date of today as too young, which is core's reading of it", () => {
    expect(read("23", "10", "2026")).toEqual({ kind: "problem", reason: "too-young" });
  });

  it("should refuse 31 February as not a real date", () => {
    expect(read("31", "02", "1991")).toEqual({ kind: "problem", reason: "not-a-date" });
  });

  it("should refuse a year of fewer than four digits as not a real date", () => {
    expect(read("14", "03", "91")).toEqual({ kind: "problem", reason: "not-a-date" });
  });

  it("should refuse a missing day as not a real date", () => {
    expect(read("", "03", "1991")).toEqual({ kind: "problem", reason: "not-a-date" });
  });

  it("should refuse a year that makes the person over 100 as too old", () => {
    expect(read("01", "01", "1900")).toEqual({ kind: "problem", reason: "too-old" });
  });
});
