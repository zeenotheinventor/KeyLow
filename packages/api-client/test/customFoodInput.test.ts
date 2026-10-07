import { describe, expect, it } from "vitest";

import { CustomFoodValidationError, parseCustomFoodInput } from "../src/customFoodInput";

const validInput = {
  name: "Protein flapjack",
  basis: "per_100g",
  kcal: 410,
  protein_g: 22,
  fat_g: 14,
  carbs_g: 45,
  portions: [],
};

describe("parseCustomFoodInput", () => {
  it("should return the parsed input with its canonical barcode", () => {
    const input = parseCustomFoodInput({ ...validInput, barcode: "0 36000-29145 2" });

    expect(input.barcode).toBe("0036000291452");
  });

  it("should throw a validation error listing the issues when the input is invalid", () => {
    const failure = (() => {
      try {
        return parseCustomFoodInput({ ...validInput, name: "  ", kcal: -1 });
      } catch (error) {
        return error;
      }
    })();

    expect(failure).toBeInstanceOf(CustomFoodValidationError);
    expect(failure).toHaveProperty("issues", expect.arrayContaining([expect.anything()]));
    expect(failure).toHaveProperty("message", expect.stringContaining("name"));
  });

  it("should throw a validation error for a value that is not an object", () => {
    expect(() => parseCustomFoodInput(null)).toThrow(CustomFoodValidationError);
  });
});
