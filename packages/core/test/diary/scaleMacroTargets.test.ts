import { describe, expect, it } from "vitest";

import { scaleMacroTargets } from "../../src/diary";

const current = { kcal: 2000, protein_g: 126, carbs_g: 245, fat_g: 73 };

describe("scaleMacroTargets", () => {
  it("should scale each macro by the new calories over the current calories", () => {
    expect(scaleMacroTargets({ ...current }, 2140)).toEqual({
      outcome: "scaled",
      macros: { protein_g: 135, carbs_g: 262, fat_g: 78 },
      anyMacroSet: true,
    });
  });

  it("should scale 126, 245 and 73 g at 2,140 kcal down to 118, 229 and 68 g at 2,000 kcal", () => {
    expect(scaleMacroTargets({ ...current, kcal: 2140 }, 2000)).toEqual({
      outcome: "scaled",
      macros: { protein_g: 118, carbs_g: 229, fat_g: 68 },
      anyMacroSet: true,
    });
  });

  it("should round a value that lands on exactly .5 up, which dividing first would get wrong", () => {
    // 38 * 1,500 / 912 is exactly 62.5. 38 * (1,500 / 912) is 62.49999999999999 in floating point, so
    // dividing first would round it down to 62.
    expect(
      scaleMacroTargets({ kcal: 912, protein_g: 38, carbs_g: null, fat_g: null }, 1500),
    ).toMatchObject({ macros: { protein_g: 63 } });
  });

  it("should keep a null macro null and scale the rest", () => {
    expect(
      scaleMacroTargets({ kcal: 2000, protein_g: 150, carbs_g: null, fat_g: 60 }, 1000),
    ).toEqual({
      outcome: "scaled",
      macros: { protein_g: 75, carbs_g: null, fat_g: 30 },
      anyMacroSet: true,
    });
  });

  it("should say no macro was set when all three are null", () => {
    expect(
      scaleMacroTargets({ kcal: 2000, protein_g: null, carbs_g: null, fat_g: null }, 1800),
    ).toEqual({
      outcome: "scaled",
      macros: { protein_g: null, carbs_g: null, fat_g: null },
      anyMacroSet: false,
    });
  });

  it("should keep a macro of 0 g as 0 g and count it as set", () => {
    expect(
      scaleMacroTargets({ kcal: 2000, protein_g: 0, carbs_g: null, fat_g: null }, 1800),
    ).toMatchObject({ macros: { protein_g: 0 }, anyMacroSet: true });
  });

  it("should have its own outcome when there is no current calorie target", () => {
    expect(scaleMacroTargets({ ...current, kcal: null }, 2000)).toEqual({
      outcome: "no_current_kcal",
    });
  });

  it("should have its own outcome when a scaled macro is over 1,000 g", () => {
    expect(scaleMacroTargets({ kcal: 800, protein_g: 900, carbs_g: 10, fat_g: 10 }, 1000)).toEqual({
      outcome: "over_limit",
    });
  });

  it("should allow a scaled macro of exactly 1,000 g", () => {
    expect(
      scaleMacroTargets({ kcal: 1000, protein_g: 500, carbs_g: null, fat_g: null }, 2000),
    ).toMatchObject({ outcome: "scaled", macros: { protein_g: 1000 } });
  });
});
