import { describe, expect, it } from "vitest";

import { checkWeightKg, parseWeightInput, parseWeightInputIn } from "../../src/weight";

describe("parseWeightInput", () => {
  it.each([
    ["81.4", 81.4],
    ["81,4", 81.4],
    ["  81.4  ", 81.4],
    ["81", 81],
    ["81.", 81],
    ["20", 20],
    ["400", 400],
    ["81.40", 81.4],
    ["81,40", 81.4],
    ["81.400", 81.4],
    ["81.00", 81],
    ["20.0", 20],
    ["400.0", 400],
    ["020", 20],
  ])("should accept %j as %s kg", (text, weightKg) => {
    expect(parseWeightInput(text)).toEqual({ ok: true, weightKg });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["abc", "not-a-number"],
    ["81 4", "not-a-number"],
    ["8.1.4", "not-a-number"],
    ["81,4,5", "not-a-number"],
    ["81.4 kg", "not-a-number"],
    ["1e3", "not-a-number"],
    ["Infinity", "not-a-number"],
    ["-", "not-a-number"],
    [".", "not-a-number"],
    ["٨١", "not-a-number"],
    ["81.45", "too-many-decimals"],
    ["81,45", "too-many-decimals"],
    ["81.401", "too-many-decimals"],
    ["814.55", "too-many-decimals"],
    ["1,001", "too-many-decimals"],
    ["1,000", "too-low"],
    ["19.9", "too-low"],
    ["-5", "too-low"],
    ["0", "too-low"],
    [".5", "too-low"],
    ["814", "too-high"],
    ["400.1", "too-high"],
    ["99999999999999999999999", "too-high"],
  ])("should refuse %j with the reason %s", (text, reason) => {
    expect(parseWeightInput(text)).toEqual({ ok: false, reason });
  });
});

describe("checkWeightKg", () => {
  it("should accept the bounds, 20 and 400 kilograms, and refuse beyond them", () => {
    expect(checkWeightKg(20)).toEqual({ ok: true });
    expect(checkWeightKg(400)).toEqual({ ok: true });
    expect(checkWeightKg(19.999)).toEqual({ ok: false, reason: "too-low" });
    expect(checkWeightKg(400.001)).toEqual({ ok: false, reason: "too-high" });
  });

  it("should refuse NaN as not a number", () => {
    expect(checkWeightKg(Number.NaN)).toEqual({ ok: false, reason: "not-a-number" });
  });

  it("should read the infinities as beyond the bounds, as a text of 310 digits always was", () => {
    expect(checkWeightKg(Number.POSITIVE_INFINITY)).toEqual({ ok: false, reason: "too-high" });
    expect(checkWeightKg(Number.NEGATIVE_INFINITY)).toEqual({ ok: false, reason: "too-low" });
    expect(parseWeightInput("9".repeat(310))).toEqual({ ok: false, reason: "too-high" });
  });
});

describe("parseWeightInputIn kilograms", () => {
  it.each([
    ["80.0", 80],
    ["80,5", 80.5],
    ["  81.4  ", 81.4],
    ["20", 20],
    ["400", 400],
  ])("should read %j as %s kg, the same as parseWeightInput", (text, weightKg) => {
    expect(parseWeightInputIn(text, "kg")).toEqual({ ok: true, weightKg });
  });

  it.each([
    ["", "empty"],
    ["heavy", "not-a-number"],
    ["81.45", "too-many-decimals"],
    ["19.9", "too-low"],
    ["400.1", "too-high"],
  ])("should refuse %j with %s", (text, reason) => {
    expect(parseWeightInputIn(text, "kg")).toEqual({ ok: false, reason });
  });
});

describe("parseWeightInputIn pounds", () => {
  it.each([
    ["176.4", 80.014],
    ["176,4", 80.014],
    ["  176.4  ", 80.014],
    ["150", 68.039],
    ["500", 226.796],
    ["44.1", 20.003],
    ["45", 20.412],
    ["881", 399.615],
    ["881.8", 399.978],
  ])("should read %j lb as %s kg, rounded to the gram", (text, weightKg) => {
    expect(parseWeightInputIn(text, "lb")).toEqual({ ok: true, weightKg });
  });

  it("should accept 44.1 lb, which is 20.003 kg, though 44 lb is 19.958 kg and refused", () => {
    expect(parseWeightInputIn("44", "lb")).toEqual({ ok: false, reason: "too-low" });
    expect(parseWeightInputIn("44.1", "lb").ok).toBe(true);
  });

  it.each([
    ["44", "too-low"],
    ["10", "too-low"],
    ["-5", "too-low"],
    ["881.9", "too-high"],
    ["882", "too-high"],
    ["1000", "too-high"],
  ])("should refuse %j lb with %s", (text, reason) => {
    expect(parseWeightInputIn(text, "lb")).toEqual({ ok: false, reason });
  });

  it.each([
    ["", "empty"],
    ["heavy", "not-a-number"],
    ["176.45", "too-many-decimals"],
  ])("should refuse %j lb with %s, which reads the same in either unit", (text, reason) => {
    expect(parseWeightInputIn(text, "lb")).toEqual({ ok: false, reason });
  });
});
