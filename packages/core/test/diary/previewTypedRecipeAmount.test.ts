import { describe, expect, it } from "vitest";

import { buildRecipeLogEntry, previewTypedRecipeAmount } from "../../src/diary";
import { computeRecipe } from "../../src/recipes";
import { buildChickenAndRiceRecipe } from "../../src/testing";

import type { LoggableRecipe } from "../../src/diary";

const chickenAndRice = (yieldGrams: number | null): LoggableRecipe => {
  const { servings, ingredients } = buildChickenAndRiceRecipe({
    servings: 4,
    ...(yieldGrams === null ? {} : { yieldGrams }),
  });
  return {
    id: "00000000-0000-4000-8000-0000000000b1",
    name: "Chicken and rice",
    servings,
    yield_grams: yieldGrams,
    computed: computeRecipe({ servings, yieldGrams, ingredients }),
  };
};

describe("previewTypedRecipeAmount", () => {
  it("should read the text as a number of servings and give the values and the grams of the entry", () => {
    const recipe = chickenAndRice(1100);

    const typed = previewTypedRecipeAmount(recipe, "serving", "1.5");
    const entry = buildRecipeLogEntry({
      recipe,
      quantity: 1.5,
      unit: "serving",
      loggedAt: "2026-10-17T18:00:00+01:00",
      localDate: "2026-10-17",
    });

    expect(typed?.amount).toEqual({ quantity: 1.5, unit: "serving" });
    expect(typed?.resolvedGrams).toBe(entry.resolved_grams);
    expect(typed?.values).toEqual({
      kcal: entry.nutrients.kcal,
      protein_g: entry.nutrients.protein_g,
      carbs_g: entry.nutrients.carbs_g,
      fat_g: entry.nutrients.fat_g,
    });
  });

  it("should read the text as grams of cooked weight", () => {
    const typed = previewTypedRecipeAmount(chickenAndRice(1100), "g", "300");

    expect(typed?.amount).toEqual({ quantity: 300, unit: "g" });
    expect(typed?.resolvedGrams).toBe(300);
  });

  it("should accept a decimal comma", () => {
    expect(previewTypedRecipeAmount(chickenAndRice(1100), "serving", "1,5")?.amount.quantity).toBe(
      1.5,
    );
  });

  it.each(["", "abc", "0", "-2"])("should give nothing for the text %j", (text) => {
    expect(previewTypedRecipeAmount(chickenAndRice(1100), "g", text)).toBeNull();
  });

  it("should give nothing for an amount too large to work out", () => {
    expect(previewTypedRecipeAmount(chickenAndRice(1100), "g", "1e308")).toBeNull();
  });
});
