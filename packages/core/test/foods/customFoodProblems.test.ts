import { describe, expect, it } from "vitest";

import { classifyCustomFoodIssues, FORM_NUTRIENTS } from "../../src/foods/customFoodProblems";
import { customFoodInputFrom } from "../../src/foods/foodForm";
import { customFoodInputSchema } from "../../src/schemas/food";

import type { FoodFormFieldsWithPortions } from "../../src/foods/foodForm";

const validValues: FoodFormFieldsWithPortions = {
  name: "Oat bar",
  brand: "",
  barcode: "",
  basis: "per_100g",
  kcal: "400",
  protein_g: "8",
  fat_g: "12",
  carbs_g: "60",
  fibre_g: "",
  portions: [],
};

function problemsFor(changes: Partial<FoodFormFieldsWithPortions>) {
  const values = { ...validValues, ...changes };
  const result = customFoodInputSchema.safeParse(customFoodInputFrom(values, null));
  return result.success ? [] : classifyCustomFoodIssues(result.error.issues, values);
}

describe("FORM_NUTRIENTS", () => {
  it("should list the nutrients a food form has, fibre last", () => {
    expect(FORM_NUTRIENTS).toEqual(["kcal", "protein_g", "carbs_g", "fat_g", "fibre_g"]);
  });
});

describe("classifyCustomFoodIssues", () => {
  it("should find no problem in valid values", () => {
    expect(problemsFor({})).toEqual([]);
  });

  describe("name", () => {
    it("should say a blank name is required", () => {
      expect(problemsFor({ name: "" })).toEqual([{ target: "name", rule: "required" }]);
    });

    it("should say a name of only spaces is required", () => {
      expect(problemsFor({ name: "   " })).toEqual([{ target: "name", rule: "required" }]);
    });

    it("should say a name over 200 characters is too long", () => {
      expect(problemsFor({ name: "a".repeat(201) })).toEqual([
        { target: "name", rule: "too_long" },
      ]);
    });
  });

  describe("brand", () => {
    it("should point at the brand when the schema rejects it", () => {
      const issues = [{ code: "invalid_type", path: ["brand"] }];

      expect(classifyCustomFoodIssues(issues, validValues)).toEqual([{ target: "brand" }]);
    });
  });

  describe("barcode", () => {
    it("should name why a barcode of the wrong length failed", () => {
      expect(problemsFor({ barcode: "12345" })).toEqual([
        { target: "barcode", rule: "bad_length" },
      ]);
    });

    it("should name a wrong check digit", () => {
      expect(problemsFor({ barcode: "4006381333932" })).toEqual([
        { target: "barcode", rule: "bad_check_digit" },
      ]);
    });

    it("should name a barcode with characters that are not digits", () => {
      expect(problemsFor({ barcode: "40063813339ab" })).toEqual([
        { target: "barcode", rule: "not_digits" },
      ]);
    });

    it("should judge the barcode without the spaces around it", () => {
      expect(problemsFor({ barcode: "  12345  " })).toEqual([
        { target: "barcode", rule: "bad_length" },
      ]);
    });

    it("should say the barcode is not valid when the schema rejected a code that does normalise", () => {
      const issues = [{ code: "custom", path: ["barcode"] }];
      const values = { ...validValues, barcode: " 4006381333931 " };

      expect(classifyCustomFoodIssues(issues, values)).toEqual([
        { target: "barcode", rule: "not_valid" },
      ]);
    });
  });

  describe("nutrients", () => {
    it.each(FORM_NUTRIENTS)("should say a %s that is not a number is not a number", (nutrient) => {
      expect(problemsFor({ [nutrient]: "lots" })).toEqual([
        { target: "nutrient", nutrient, rule: "not_a_number" },
      ]);
    });

    it.each(FORM_NUTRIENTS.filter((nutrient) => nutrient !== "fibre_g"))(
      "should say a blank %s is required",
      (nutrient) => {
        expect(problemsFor({ [nutrient]: "  " })).toEqual([
          { target: "nutrient", nutrient, rule: "required" },
        ]);
      },
    );

    it.each(FORM_NUTRIENTS)("should say a negative %s is negative", (nutrient) => {
      expect(problemsFor({ [nutrient]: "-1" })).toEqual([
        { target: "nutrient", nutrient, rule: "negative" },
      ]);
    });
  });

  describe("portions", () => {
    const portion = { label: "Slice", amount: "30", isDefault: false };

    it("should point at the label of the portion that has none, by its place in the list", () => {
      expect(problemsFor({ portions: [portion, { ...portion, label: " " }] })).toEqual([
        { target: "portion", index: 1, field: "label" },
      ]);
    });

    it.each([
      ["blank", ""],
      ["zero", "0"],
      ["not a number", "lots"],
    ])("should point at the amount of a portion whose amount is %s", (_name, amount) => {
      expect(problemsFor({ portions: [{ ...portion, amount }, portion] })).toEqual([
        { target: "portion", index: 0, field: "amount" },
      ]);
    });

    it("should give one problem for each field that failed, label first", () => {
      expect(problemsFor({ portions: [{ label: "", amount: "", isDefault: false }] })).toEqual([
        { target: "portion", index: 0, field: "label" },
        { target: "portion", index: 0, field: "amount" },
      ]);
    });

    it("should point at the portion list as a whole when more than one portion is the default", () => {
      const defaultPortion = { ...portion, isDefault: true };

      expect(problemsFor({ portions: [defaultPortion, defaultPortion] })).toEqual([
        { target: "portions" },
      ]);
    });

    it("should send an issue on a negative portion index to the form", () => {
      const issues = [{ code: "too_small", path: ["portions", -1, "label"] }];
      const values = { ...validValues, portions: [{ label: "", amount: "", isDefault: false }] };

      expect(classifyCustomFoodIssues(issues, values)).toEqual([{ target: "form" }]);
    });

    it("should send an issue on a portion the form does not have to the form", () => {
      const issues = [{ code: "too_small", path: ["portions", 2, "label"] }];

      expect(classifyCustomFoodIssues(issues, validValues)).toEqual([{ target: "form" }]);
    });
  });

  describe("everything else", () => {
    it("should send an issue on a field the form does not have to the form", () => {
      const issues = [{ code: "too_small", path: ["sat_fat_g"] }];

      expect(classifyCustomFoodIssues(issues, validValues)).toEqual([{ target: "form" }]);
    });

    it("should send an issue with no path to the form", () => {
      expect(classifyCustomFoodIssues([{ code: "custom", path: [] }], validValues)).toEqual([
        { target: "form" },
      ]);
    });
  });

  it("should give one problem for each issue, in the order the issues came", () => {
    expect(
      problemsFor({ name: "", kcal: "-1", barcode: "12345" }).map((problem) => problem.target),
    ).toEqual(["name", "barcode", "nutrient"]);
  });
});
