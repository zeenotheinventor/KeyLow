import { describe, expect, it } from "vitest";

import { validateQuickAdd } from "../../../src/diary/rules/validateQuickAdd";

const noMacros = { protein_g: null, fat_g: null, carbs_g: null, label: null };

describe("validateQuickAdd", () => {
  it("should accept calories alone", () => {
    expect(validateQuickAdd({ kcal: 130, ...noMacros })).toEqual({
      ok: true,
      value: { kcal: 130, ...noMacros },
    });
  });

  it("should accept calories, macros and a label", () => {
    const quickAdd = {
      kcal: 130,
      protein_g: 2,
      fat_g: 7,
      carbs_g: 15,
      label: "Meal deal crisps",
    };

    expect(validateQuickAdd(quickAdd)).toEqual({ ok: true, value: quickAdd });
  });

  it("should accept a fraction of a calorie above 0", () => {
    expect(validateQuickAdd({ kcal: 0.5, ...noMacros }).ok).toBe(true);
  });

  it("should refuse 0 calories", () => {
    expect(validateQuickAdd({ kcal: 0, ...noMacros })).toEqual({
      ok: false,
      problems: { kcal: "not_above_zero" },
    });
  });

  it("should refuse negative calories", () => {
    expect(validateQuickAdd({ kcal: -10, ...noMacros })).toEqual({
      ok: false,
      problems: { kcal: "not_above_zero" },
    });
  });

  it("should refuse calories left blank", () => {
    expect(validateQuickAdd({ kcal: null, ...noMacros })).toEqual({
      ok: false,
      problems: { kcal: "required" },
    });
  });

  it("should refuse calories that are not a number", () => {
    expect(validateQuickAdd({ kcal: Number.NaN, ...noMacros })).toEqual({
      ok: false,
      problems: { kcal: "required" },
    });
  });

  it("should accept a macro of 0 and refuse a negative one", () => {
    expect(validateQuickAdd({ kcal: 130, ...noMacros, protein_g: 0 }).ok).toBe(true);
    expect(validateQuickAdd({ kcal: 130, ...noMacros, fat_g: -1 })).toEqual({
      ok: false,
      problems: { fat_g: "negative" },
    });
  });

  it("should trim the label", () => {
    expect(validateQuickAdd({ kcal: 130, ...noMacros, label: "  Crisps " })).toMatchObject({
      ok: true,
      value: { label: "Crisps" },
    });
  });

  it("should turn a blank label into null", () => {
    expect(validateQuickAdd({ kcal: 130, ...noMacros, label: "   " })).toMatchObject({
      ok: true,
      value: { label: null },
    });
  });

  it("should leave the offending number out of every problem", () => {
    const result = validateQuickAdd({ kcal: -4321, ...noMacros });

    expect(JSON.stringify(result)).not.toContain("4321");
  });

  it.each([
    ["NaN", Number.NaN],
    ["infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
  ])("should refuse a macro that is %s as invalid, not as negative", (_name, value) => {
    expect(validateQuickAdd({ kcal: 130, ...noMacros, carbs_g: value })).toEqual({
      ok: false,
      problems: { carbs_g: "invalid" },
    });
  });

  it("should call a macro below 0 negative, not invalid", () => {
    expect(validateQuickAdd({ kcal: 130, ...noMacros, protein_g: -0.5 })).toEqual({
      ok: false,
      problems: { protein_g: "negative" },
    });
  });
});
