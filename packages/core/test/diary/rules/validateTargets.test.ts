import { describe, expect, it } from "vitest";

import {
  TARGET_KCAL_MAXIMUM,
  TARGET_KCAL_MINIMUM,
  validateTargets,
} from "../../../src/diary/rules/validateTargets";

const noMacros = { protein_g: null, fat_g: null, carbs_g: null };

describe("the target limits", () => {
  it("should pin the calorie limits to 800 and 6000", () => {
    expect(TARGET_KCAL_MINIMUM).toBe(800);
    expect(TARGET_KCAL_MAXIMUM).toBe(6000);
  });
});

describe("validateTargets", () => {
  it("should accept calories alone", () => {
    expect(validateTargets({ kcal: 2200, ...noMacros })).toEqual({
      ok: true,
      value: { kcal: 2200, ...noMacros },
    });
  });

  it("should accept calories with all three macros", () => {
    const targets = { kcal: 2200, protein_g: 160, fat_g: 70, carbs_g: 220 };

    expect(validateTargets(targets)).toEqual({ ok: true, value: targets });
  });

  it("should accept the lowest calorie target, 800", () => {
    expect(validateTargets({ kcal: 800, ...noMacros }).ok).toBe(true);
  });

  it("should refuse 799 calories", () => {
    expect(validateTargets({ kcal: 799, ...noMacros })).toEqual({
      ok: false,
      problems: { kcal: "out_of_range" },
    });
  });

  it("should accept the highest calorie target, 6000", () => {
    expect(validateTargets({ kcal: 6000, ...noMacros }).ok).toBe(true);
  });

  it("should refuse 6001 calories", () => {
    expect(validateTargets({ kcal: 6001, ...noMacros })).toEqual({
      ok: false,
      problems: { kcal: "out_of_range" },
    });
  });

  it("should refuse calories left blank", () => {
    expect(validateTargets({ kcal: null, ...noMacros })).toEqual({
      ok: false,
      problems: { kcal: "required" },
    });
  });

  it("should refuse calories that are not a number", () => {
    expect(validateTargets({ kcal: Number.NaN, ...noMacros })).toEqual({
      ok: false,
      problems: { kcal: "required" },
    });
  });

  it("should accept a macro of 0", () => {
    expect(validateTargets({ kcal: 2200, protein_g: 0, fat_g: 0, carbs_g: 0 }).ok).toBe(true);
  });

  it("should refuse a negative macro and name which one", () => {
    expect(validateTargets({ kcal: 2200, protein_g: -1, fat_g: 70, carbs_g: -0.5 })).toEqual({
      ok: false,
      problems: { protein_g: "negative", carbs_g: "negative" },
    });
  });

  it("should report the calorie problem and the macro problem together", () => {
    expect(validateTargets({ kcal: 100, protein_g: -1, fat_g: null, carbs_g: null })).toEqual({
      ok: false,
      problems: { kcal: "out_of_range", protein_g: "negative" },
    });
  });

  it("should leave the offending number out of every problem", () => {
    const result = validateTargets({ kcal: 7321, ...noMacros });

    expect(JSON.stringify(result)).not.toContain("7321");
  });
  it.each([
    ["NaN", Number.NaN],
    ["infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
  ])("should refuse a macro that is %s as invalid, not as negative", (_name, value) => {
    expect(validateTargets({ kcal: 2200, protein_g: value, fat_g: null, carbs_g: null })).toEqual({
      ok: false,
      problems: { protein_g: "invalid" },
    });
  });

  it("should call a macro below 0 negative, not invalid", () => {
    expect(validateTargets({ kcal: 2200, protein_g: null, fat_g: -0.5, carbs_g: null })).toEqual({
      ok: false,
      problems: { fat_g: "negative" },
    });
  });

  it.each([2200.5, 800.1, 5999.9])("should refuse %s calories as not whole", (kcal) => {
    expect(validateTargets({ kcal, ...noMacros })).toEqual({
      ok: false,
      problems: { kcal: "not_whole" },
    });
  });

  it("should call a fraction outside the range out of range, not not whole", () => {
    expect(validateTargets({ kcal: 799.5, ...noMacros })).toEqual({
      ok: false,
      problems: { kcal: "out_of_range" },
    });
  });

  it("should allow a fractional macro, because the macro columns are numeric", () => {
    expect(validateTargets({ kcal: 2200, protein_g: 150.5, fat_g: null, carbs_g: null }).ok).toBe(
      true,
    );
  });
});
