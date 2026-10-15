import { describe, expect, it } from "vitest";

import { enteredNumber, fieldText } from "../../../src/diary/rules/enteredNumber";
import { validateTargets } from "../../../src/diary/rules/validateTargets";

describe("enteredNumber", () => {
  it("should read a blank field as no number", () => {
    expect(enteredNumber("")).toBeNull();
    expect(enteredNumber("   ")).toBeNull();
  });

  it("should read digits, a decimal point and a decimal comma", () => {
    expect(enteredNumber("2200")).toBe(2200);
    expect(enteredNumber(" 12.5 ")).toBe(12.5);
    expect(enteredNumber("12,5")).toBe(12.5);
  });

  it("should read text that is not a number as NaN, which validateTargets refuses", () => {
    const text = enteredNumber("abc");

    expect(text).toBeNaN();
    expect(validateTargets({ kcal: text, protein_g: null, fat_g: null, carbs_g: null }).ok).toBe(
      false,
    );
  });
});

describe("fieldText", () => {
  it("should write nothing for no target and the number otherwise", () => {
    expect(fieldText(null)).toBe("");
    expect(fieldText(2200)).toBe("2200");
    expect(fieldText(0)).toBe("0");
  });
});
