import { describe, expect, it } from "vitest";

import {
  RECIPE_DRAFT_ADJUST_PREFILL,
  RECIPE_DRAFT_WORDS,
  RECIPE_WORKING_HINT,
  composerTextForAdjust,
  describeRecipeDraftAsked,
  describeRecipeDraftFitWithin,
  describeRecipeDraftMiss,
  describeRecipeDraftSteps,
  describeRecipeDraftSubtitle,
} from "../../src/copy";

describe("RECIPE_DRAFT_WORDS", () => {
  it("should hold the words of the draft card as the boards write them", () => {
    expect(RECIPE_DRAFT_WORDS).toEqual({
      perServing: "Per serving",
      captions: { kcal: "kcal", protein_g: "Protein", carbs_g: "Carbs", fat_g: "Fat" },
      instructions: "Instructions",
      save: "Save to recipes",
      adjust: "Adjust",
      saveFailed: "Not saved. Check your connection and try again.",
      notMatched: "Not matched",
    });
  });

  it("should put Change this recipe, with its trailing space, in the composer on Adjust", () => {
    expect(RECIPE_DRAFT_ADJUST_PREFILL).toBe("Change this recipe: ");
  });
});

describe("RECIPE_WORKING_HINT", () => {
  it("should say how long a recipe takes, after 8 seconds, for the two generation tools only", () => {
    expect(RECIPE_WORKING_HINT).toEqual({
      words: "Recipes take longer, up to about 40 seconds.",
      afterMilliseconds: 8000,
      tools: ["suggest_recipe", "adjust_recipe"],
    });
  });
});

describe("describeRecipeDraftSubtitle", () => {
  it("should say the draft is not saved yet", () => {
    expect(describeRecipeDraftSubtitle(2, false)).toBe("2 servings · Not saved yet");
    expect(describeRecipeDraftSubtitle(1, false)).toBe("1 serving · Not saved yet");
  });

  it("should say it is saved once it is", () => {
    expect(describeRecipeDraftSubtitle(2, true)).toBe("2 servings · Saved to your recipes");
  });
});

describe("describeRecipeDraftAsked", () => {
  it("should print calories bare and the rest in grams", () => {
    expect(describeRecipeDraftAsked("kcal", 600)).toBe("Asked 600");
    expect(describeRecipeDraftAsked("protein_g", 45)).toBe("Asked 45 g");
    expect(describeRecipeDraftAsked("fat_g", 9.5)).toBe("Asked 9.5 g");
  });
});

describe("describeRecipeDraftSteps", () => {
  it("should count the steps", () => {
    expect(describeRecipeDraftSteps(4)).toBe("4 steps");
    expect(describeRecipeDraftSteps(1)).toBe("1 step");
  });
});

describe("describeRecipeDraftFitWithin", () => {
  it("should state the tolerance of each named target, calories by percent and the rest in grams", () => {
    expect(describeRecipeDraftFitWithin({ kcal: 600, protein_g: 45 }, [])).toBe(
      "Within 5 % of 600 kcal and 5 g of 45 g protein",
    );
  });

  it("should name carbs and fat only when they were named", () => {
    expect(
      describeRecipeDraftFitWithin({ kcal: 600, protein_g: 45, carbs_g: 60, fat_g: 20 }, []),
    ).toBe("Within 5 % of 600 kcal, 5 g of 45 g protein, 5 g of 60 g carbs and 5 g of 20 g fat");
    expect(describeRecipeDraftFitWithin({ kcal: 500 }, [])).toBe("Within 5 % of 500 kcal");
  });

  it("should say what was left out of the numbers", () => {
    expect(describeRecipeDraftFitWithin({ kcal: 500, protein_g: 50 }, ["harissa paste"])).toBe(
      "Within 5 % of 500 kcal and 5 g of 50 g protein, without the harissa paste",
    );
    expect(describeRecipeDraftFitWithin({ kcal: 500 }, ["harissa paste", "sumac"])).toBe(
      "Within 5 % of 500 kcal, without the harissa paste and the sumac",
    );
  });
});

describe("describeRecipeDraftMiss", () => {
  it("should say how far under the target a figure is, and what held it back", () => {
    expect(
      describeRecipeDraftMiss({
        nutrient: "protein_g",
        target: 60,
        achieved: 53,
        reason: "ingredient_bounds",
        limitedBy: ["salmon fillet", "boiled potatoes"],
      }),
    ).toBe(
      "Protein is 7 g under the 60 g you asked for. It is held back by the salmon fillet and the boiled potatoes.",
    );
  });

  it("should say over when the figure is above the target, and give calories in kcal", () => {
    expect(
      describeRecipeDraftMiss({
        nutrient: "kcal",
        target: 600,
        achieved: 700,
        reason: "ingredient_bounds",
        limitedBy: ["olive oil"],
      }),
    ).toBe(
      "Calories are 100 kcal over the 600 kcal you asked for. It is held back by the olive oil.",
    );
  });

  it("should word a conflict between the targets without naming an ingredient", () => {
    expect(
      describeRecipeDraftMiss({
        nutrient: "protein_g",
        target: 60,
        achieved: 50,
        reason: "targets_conflict",
        limitedBy: [],
      }),
    ).toBe(
      "Protein is 10 g under the 60 g you asked for. The figures you asked for pull against each other, so this is the closest fit.",
    );
  });

  it("should word any other miss with no ingredient as the closest fit", () => {
    expect(
      describeRecipeDraftMiss({
        nutrient: "fat_g",
        target: 10,
        achieved: 22,
        reason: "no_adjustable_ingredient",
        limitedBy: [],
      }),
    ).toBe(
      "Fat is 12 g over the 10 g you asked for. This is the closest fit these ingredients allow.",
    );
  });

  it("should say a figure could not be checked when the foods have no data for it", () => {
    expect(
      describeRecipeDraftMiss({
        nutrient: "carbs_g",
        target: 50,
        achieved: null,
        reason: "no_data",
        limitedBy: [],
      }),
    ).toBe("Carbs could not be checked, because these foods have no carbs figure.");
  });
});

describe("describeRecipeDraftFitWithin, with no figure named", () => {
  it("should say nothing, so Within is never shown with nothing after it", () => {
    expect(describeRecipeDraftFitWithin({}, [])).toBeNull();
    expect(describeRecipeDraftFitWithin({ kcal: undefined }, ["harissa paste"])).toBeNull();
  });
});

describe("composerTextForAdjust", () => {
  it("should give the words for changing a recipe when the composer is empty or blank", () => {
    expect(composerTextForAdjust("")).toBe("Change this recipe: ");
    expect(composerTextForAdjust("   ")).toBe("Change this recipe: ");
  });

  it("should keep what the person already typed", () => {
    expect(composerTextForAdjust("More rice please")).toBe("More rice please");
  });
});
