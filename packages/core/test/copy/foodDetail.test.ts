import { describe, expect, it } from "vitest";

import {
  FOOD_DETAIL,
  FOOD_MACRO_LABELS,
  FOOD_NOT_FOUND,
  FOOD_NOT_LOADED,
  FOOD_NUTRIENT_LABELS,
  describeMissingValues,
  describeNutritionHeading,
} from "../../src/copy";

describe("food detail wording", () => {
  it("should pin the drawn labels", () => {
    expect(FOOD_DETAIL).toEqual({
      title: "Food",
      back: "Back to foods",
      edit: "Edit",
      loading: "Loading food",
      macrosLabel: "Energy and macros",
      portions: "Portions",
      defaultPortion: "Default",
      usCarbsNote: "Carbohydrate includes fibre (US labelling convention).",
    });
  });

  it("should pin the failure and not found states", () => {
    expect(FOOD_NOT_LOADED).toEqual({
      title: "Food not loaded",
      body: "The food could not be loaded. Try again later.",
    });
    expect(FOOD_NOT_FOUND).toEqual({
      title: "Food not found",
      body: "This food does not exist, or you cannot see it.",
    });
  });

  it("should pin the nutrient and macro labels", () => {
    expect(FOOD_NUTRIENT_LABELS).toEqual({
      energy: "Energy",
      protein: "Protein",
      carbohydrate: "Carbohydrate",
      fat: "Fat",
      fibre: "Fibre",
    });
    expect(FOOD_MACRO_LABELS).toEqual({ protein: "Protein", carbs: "Carbs", fat: "Fat" });
  });
});

describe("describeNutritionHeading", () => {
  it("should head the table with the food's basis", () => {
    expect(describeNutritionHeading("per_100g")).toBe("Nutrition per 100 g");
    expect(describeNutritionHeading("per_100ml")).toBe("Nutrition per 100 ml");
  });
});

describe("describeMissingValues", () => {
  it("should name one missing nutrient and say to fill it in", () => {
    expect(describeMissingValues(["protein_g"], undefined)).toBe(
      "Protein is not given. Fill it in to save your own copy of this food.",
    );
  });

  it("should name several in the order of the nutrition table, whatever order they arrive in", () => {
    expect(describeMissingValues(["carbs_g", "kcal"], undefined)).toBe(
      "Energy and carbohydrate are not given. Fill them in to save your own copy of this food.",
    );
  });

  it("should join three with commas and an and", () => {
    expect(describeMissingValues(["fibre_g", "protein_g", "fat_g"], undefined)).toBe(
      "Protein, fat and fibre are not given. Fill them in to save your own copy of this food.",
    );
  });

  it("should say carbohydrate still includes fibre when only fibre is missing from a US label", () => {
    expect(describeMissingValues(["fibre_g"], "us_total")).toBe(
      "Fibre is not given, so carbohydrate still includes it. Fill it in to save your own copy of this food.",
    );
  });

  it("should not say that when fibre is missing from a label that is not a US total", () => {
    expect(describeMissingValues(["fibre_g"], "eu")).toBe(
      "Fibre is not given. Fill it in to save your own copy of this food.",
    );
  });

  it("should not say that when other nutrients are missing too", () => {
    expect(describeMissingValues(["protein_g", "fibre_g"], "us_total")).toBe(
      "Protein and fibre are not given. Fill them in to save your own copy of this food.",
    );
  });

  it("should fall back to a general sentence when no known nutrient is named", () => {
    const general = "Some values are not given. Fill them in to save your own copy of this food.";

    expect(describeMissingValues([], undefined)).toBe(general);
    expect(describeMissingValues(["salt_g"], undefined)).toBe(general);
  });
});
