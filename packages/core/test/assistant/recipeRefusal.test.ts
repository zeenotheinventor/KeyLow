import { describe, expect, it } from "vitest";

import { assistantRecipeRefusalSchema, recipeRefusalOf } from "../../src/assistant";
import { MAX_RECIPE_NAME_LENGTH } from "../../src/recipes/bounds";

const reached = { kcal: 389.4, protein_g: 17.2, carbs_g: 60, fat_g: 8 };

describe("recipeRefusalOf", () => {
  it("should keep what the card words: the recipe, what was asked, and the closest figure and calories reached", () => {
    expect(
      recipeRefusalOf({
        recipeName: "Eval porridge bowl",
        nutrient: "protein_g",
        target: { kcal: 389.4, protein_g: 53 },
        reached,
      }),
    ).toEqual({
      recipeName: "Eval porridge bowl",
      nutrient: "protein_g",
      target: 53,
      reached: 17.2,
      reachedKcal: 389.4,
    });
  });

  it("should leave the calories out when the calories are what was asked, so they are not said twice", () => {
    expect(
      recipeRefusalOf({
        recipeName: "Eval porridge bowl",
        nutrient: "kcal",
        target: { kcal: 250 },
        reached,
      }),
    ).toMatchObject({ nutrient: "kcal", target: 250, reached: 389.4, reachedKcal: null });
  });

  it("should leave the calories out when they drifted past the tolerance of the calories held", () => {
    // 5 % of 389.4 is about 19.5 kcal, so 420 is out and 400 is in.
    const refusalAt = (kcal: number) =>
      recipeRefusalOf({
        recipeName: "Bowl",
        nutrient: "protein_g",
        target: { kcal: 389.4, protein_g: 53 },
        reached: { ...reached, kcal },
      });

    expect(refusalAt(400)?.reachedKcal).toBe(400);
    expect(refusalAt(420)?.reachedKcal).toBeNull();
  });

  it("should leave the calories out when no calorie target was held", () => {
    expect(
      recipeRefusalOf({
        recipeName: "Bowl",
        nutrient: "protein_g",
        target: { protein_g: 53 },
        reached,
      })?.reachedKcal,
    ).toBeNull();
  });

  it("should leave the calories out when no ingredient has a calorie figure", () => {
    expect(
      recipeRefusalOf({
        recipeName: "Bowl",
        nutrient: "protein_g",
        target: { kcal: 389.4, protein_g: 53 },
        reached: { ...reached, kcal: null },
      }),
    ).toMatchObject({ reachedKcal: null });
  });

  it("should answer null when the closest figure is unknown, because the card would have nothing to say", () => {
    expect(
      recipeRefusalOf({
        recipeName: "Bowl",
        nutrient: "protein_g",
        target: { protein_g: 53 },
        reached: { ...reached, protein_g: null },
      }),
    ).toBeNull();
  });

  it("should answer null when the target has no figure for what was asked", () => {
    expect(
      recipeRefusalOf({ recipeName: "Bowl", nutrient: "fat_g", target: { kcal: 400 }, reached }),
    ).toBeNull();
  });

  it("should cut a name that would pass the longest a recipe may have", () => {
    const refusal = recipeRefusalOf({
      recipeName: "a".repeat(MAX_RECIPE_NAME_LENGTH + 20),
      nutrient: "protein_g",
      target: { protein_g: 53 },
      reached,
    });

    expect(refusal?.recipeName).toHaveLength(MAX_RECIPE_NAME_LENGTH);
  });
});

describe("assistantRecipeRefusalSchema", () => {
  const refusal = {
    recipeName: "Eval porridge bowl",
    nutrient: "protein_g",
    target: 53,
    reached: 17.2,
    reachedKcal: 389.4,
  };

  it("should read a refusal and strip a field a later version adds", () => {
    expect(assistantRecipeRefusalSchema.parse({ ...refusal, later: 1 })).toEqual(refusal);
  });

  it("should refuse a nutrient it does not know", () => {
    expect(
      assistantRecipeRefusalSchema.safeParse({ ...refusal, nutrient: "fibre_g" }).success,
    ).toBe(false);
  });
});
