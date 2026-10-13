import { describe, expect, it } from "vitest";

import {
  FOOD_FORM_BARCODE_NOT_VALID,
  FOOD_FORM_BARCODE_PROBLEMS,
  FOOD_FORM_BUTTONS,
  FOOD_REVIEW_BANNER,
  describeNameProblem,
  describeNutrientProblem,
  describePortionAmountProblem,
  describePortionLabelAndAmountProblem,
  describePortionLabelProblem,
} from "../../src/copy";

describe("food form buttons and review banner", () => {
  it("should pin the button labels", () => {
    expect(FOOD_FORM_BUTTONS).toEqual({
      create: "Create food",
      copy: "Save to your foods",
      edit: "Save changes",
    });
  });

  it("should pin the review banner wording", () => {
    expect(FOOD_REVIEW_BANNER).toEqual({ title: "Needs review", action: "Copy to your foods" });
  });
});

describe("describeNameProblem", () => {
  it("should pin the drawn sentence", () => {
    expect(describeNameProblem("required")).toBe("Name is required");
  });

  it("should pin the length sentence", () => {
    expect(describeNameProblem("too_long")).toBe("Name must be 200 characters or fewer");
  });
});

describe("describeNutrientProblem", () => {
  it("should pin the drawn sentences", () => {
    expect(describeNutrientProblem("kcal", "required")).toBe("Energy is required");
    expect(describeNutrientProblem("fat_g", "negative")).toBe("Fat cannot be negative");
    expect(describeNutrientProblem("protein_g", "required")).toBe("Protein is required");
  });

  it.each([
    ["kcal", "Energy"],
    ["protein_g", "Protein"],
    ["fat_g", "Fat"],
    ["carbs_g", "Carbohydrate"],
    ["fibre_g", "Fibre"],
  ] as const)("should name %s as %s in all three sentences", (nutrient, subject) => {
    expect(describeNutrientProblem(nutrient, "required")).toBe(`${subject} is required`);
    expect(describeNutrientProblem(nutrient, "negative")).toBe(`${subject} cannot be negative`);
    expect(describeNutrientProblem(nutrient, "not_a_number")).toBe(`${subject} must be a number`);
  });
});

describe("portion problems", () => {
  it("should pin the drawn mobile sentences, one for each field", () => {
    expect(describePortionLabelProblem(1)).toBe("Portion 1 needs a label");
    expect(describePortionAmountProblem(1)).toBe("Portion 1 needs an amount above 0");
  });

  it("should number the portion", () => {
    expect(describePortionLabelProblem(3)).toBe("Portion 3 needs a label");
    expect(describePortionAmountProblem(3)).toBe("Portion 3 needs an amount above 0");
  });

  it("should pin the drawn web sentence for a portion missing both", () => {
    expect(describePortionLabelAndAmountProblem(1)).toBe(
      "Portion 1 needs a label and an amount above 0",
    );
  });
});

describe("barcode problems on the food form", () => {
  it("should keep the sentences the mobile form shows today", () => {
    expect(FOOD_FORM_BARCODE_PROBLEMS).toEqual({
      not_digits: "Barcode can only contain digits",
      bad_length: "Barcode must have 8, 12, 13 or 14 digits",
      bad_check_digit: "Barcode check digit is wrong",
      not_upc_e: "Barcode is not a valid product code",
    });
    expect(FOOD_FORM_BARCODE_NOT_VALID).toBe("Barcode is not valid");
  });
});
