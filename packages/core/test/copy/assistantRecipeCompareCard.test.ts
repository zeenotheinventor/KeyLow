import { describe, expect, it } from "vitest";

import {
  RECIPE_COMPARE_WORDS,
  describeAdjustedRecipeName,
  describeRecipeCompareAmounts,
  describeRecipeCompareChange,
  describeRecipeCompareFitWithin,
  describeRecipeCompareStays,
  describeRecipeCompareSubtitle,
} from "../../src/copy";
import { MAX_RECIPE_NAME_LENGTH } from "../../src/recipes/bounds";

describe("RECIPE_COMPARE_WORDS", () => {
  it("should hold the words of the compare card as the board writes them", () => {
    expect(RECIPE_COMPARE_WORDS).toEqual({
      perServing: "Per serving",
      before: "Before",
      after: "After",
      captions: { kcal: "kcal", protein_g: "Protein", carbs_g: "Carbs", fat_g: "Fat" },
      save: "Save as new recipe",
      changed: "Changed",
      added: "Added",
      removed: "Removed",
      cannotSave: "This version can't be saved yet, because it has an item counted by portion.",
    });
  });
});

describe("describeAdjustedRecipeName", () => {
  it("should name the new recipe after the original, as the board's title does", () => {
    expect(describeAdjustedRecipeName("Eval chicken and rice")).toBe(
      "Eval chicken and rice, adjusted",
    );
  });

  it("should keep a long name inside the longest a recipe may be called, ending in the suffix", () => {
    const named = describeAdjustedRecipeName("a".repeat(MAX_RECIPE_NAME_LENGTH));

    expect(named).toHaveLength(MAX_RECIPE_NAME_LENGTH);
    expect(named.endsWith(", adjusted")).toBe(true);
  });
});

describe("describeRecipeCompareChange", () => {
  it("should say how much more or less of a macro a serving has", () => {
    expect(describeRecipeCompareChange("protein_g", 30)).toBe("30 g more protein a serving");
    expect(describeRecipeCompareChange("carbs_g", -20)).toBe("20 g less carbs a serving");
    expect(describeRecipeCompareChange("fat_g", 7.5)).toBe("7.5 g more fat a serving");
  });

  it("should say it in calories for the calories", () => {
    expect(describeRecipeCompareChange("kcal", -150)).toBe("150 kcal less a serving");
  });
});

describe("describeRecipeCompareSubtitle", () => {
  it("should join the change, the servings and that it is not saved yet", () => {
    expect(describeRecipeCompareSubtitle("30 g more protein a serving", 2, false)).toBe(
      "30 g more protein a serving · 2 servings · Not saved yet",
    );
  });

  it("should say it is saved once it is", () => {
    expect(describeRecipeCompareSubtitle("30 g more protein a serving", 1, true)).toBe(
      "30 g more protein a serving · 1 serving · Saved to your recipes",
    );
  });

  it("should leave the change out when the figures name none", () => {
    expect(describeRecipeCompareSubtitle(null, 2, false)).toBe("2 servings · Not saved yet");
  });
});

describe("describeRecipeCompareFitWithin", () => {
  it("should name the protein first, then the calories, with the tolerance of each (5 g, 5 %)", () => {
    expect(describeRecipeCompareFitWithin({ kcal: 518.2, protein_g: 79.3 })).toBe(
      "Protein within 5 g of 79 g, calories within 5 % of 518 kcal",
    );
  });

  it("should put carbs and fat in only when they were named", () => {
    expect(describeRecipeCompareFitWithin({ carbs_g: 40 })).toBe("Carbs within 5 g of 40 g");
    expect(describeRecipeCompareFitWithin({ protein_g: 60, fat_g: 10, kcal: 500 })).toBe(
      "Protein within 5 g of 60 g, fat within 5 g of 10 g, calories within 5 % of 500 kcal",
    );
  });

  it("should be null when no figure was named", () => {
    expect(describeRecipeCompareFitWithin({})).toBeNull();
  });
});

describe("describeRecipeCompareAmounts", () => {
  it("should draw a changed line as before to after", () => {
    expect(describeRecipeCompareAmounts({ change: "changed", before: 260, grams: 455 }, true)).toBe(
      "260 g → 455 g",
    );
  });

  it("should say an unchanged line is unchanged", () => {
    expect(describeRecipeCompareAmounts({ change: "same", before: 160, grams: 160 }, true)).toBe(
      "160 g, unchanged",
    );
  });

  it("should say a line counted by portion is unchanged without printing 0 g (NOT ON THE CANVAS)", () => {
    expect(describeRecipeCompareAmounts({ change: "same", before: 0, grams: 0 }, true)).toBe(
      "Counted by portion, unchanged",
    );
  });

  it("should say an added food is not in the method when the recipe has one (NOT ON THE CANVAS)", () => {
    expect(describeRecipeCompareAmounts({ change: "added", before: null, grams: 120 }, true)).toBe(
      "120 g added, not in the method",
    );
  });

  it("should leave out the method when the recipe has no steps", () => {
    expect(describeRecipeCompareAmounts({ change: "added", before: null, grams: 120 }, false)).toBe(
      "120 g added",
    );
  });

  it("should say a removed line was removed", () => {
    expect(describeRecipeCompareAmounts({ change: "removed", before: 30, grams: 0 }, true)).toBe(
      "30 g, removed",
    );
  });

  it("should draw a changed line that has no before as its grams alone", () => {
    expect(describeRecipeCompareAmounts({ change: "changed", before: null, grams: 50 }, true)).toBe(
      "50 g",
    );
  });
});

describe("describeRecipeCompareStays", () => {
  it("should say the original stays as it is", () => {
    expect(describeRecipeCompareStays("Eval chicken and rice")).toBe(
      "Eval chicken and rice stays as it is.",
    );
  });
});
