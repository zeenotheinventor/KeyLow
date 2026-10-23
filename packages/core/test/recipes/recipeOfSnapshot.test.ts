import { describe, expect, it } from "vitest";

import { buildRecipeLogEntry } from "../../src/diary";
import { computeRecipe, per100gOf, recipeOfSnapshot } from "../../src/recipes";
import { buildChickenAndRiceRecipe } from "../../src/testing";

import type { LoggableRecipe } from "../../src/diary";
import type { RecipeComputed } from "../../src/recipes";

const recipeId = "00000000-0000-4000-8000-0000000000b1";

const chickenAndRice = (
  yieldGrams: number | null,
): LoggableRecipe & { computed: RecipeComputed } => {
  const { servings, ingredients } = buildChickenAndRiceRecipe({ servings: 4, yieldGrams });
  return {
    id: recipeId,
    name: "Chicken and rice",
    servings,
    yield_grams: yieldGrams,
    computed: computeRecipe({ servings, yieldGrams, ingredients }),
  };
};

const snapshotOf = (recipe: LoggableRecipe, quantity = 1) =>
  buildRecipeLogEntry({
    recipe,
    quantity,
    unit: "serving",
    loggedAt: "2026-10-17T12:30:00+01:00",
    localDate: "2026-10-17",
  }).snapshot;

describe("recipeOfSnapshot", () => {
  it("should give back the name, servings and cooked weight the entry was logged with", () => {
    const recipe = recipeOfSnapshot(snapshotOf(chickenAndRice(1100)));

    expect(recipe).toMatchObject({
      id: recipeId,
      name: "Chicken and rice",
      servings: 4,
      yield_grams: 1100,
    });
  });

  it("should give the values per 100 g the recipe's own cache gave when it was logged", () => {
    const original = chickenAndRice(1100);
    const recipe = recipeOfSnapshot(snapshotOf(original));

    expect(recipe.computed.per100g).toEqual(original.computed.per100g);
    expect(recipe.computed.total).toEqual(original.computed.total);
    expect(recipe.computed.effectiveGrams).toBe(original.computed.effectiveGrams);
  });

  it("should work per 100 g of the raw total for a recipe logged with no cooked weight", () => {
    const original = chickenAndRice(null);
    const recipe = recipeOfSnapshot(snapshotOf(original));

    expect(recipe.yield_grams).toBeNull();
    expect(recipe.computed.per100g).toEqual(original.computed.per100g);
    expect(recipe.computed.effectiveGrams).toBe(original.computed.totalGrams);
  });

  it("should not depend on how much was logged", () => {
    const original = chickenAndRice(1100);

    expect(recipeOfSnapshot(snapshotOf(original, 2.5)).computed).toEqual(
      recipeOfSnapshot(snapshotOf(original, 1)).computed,
    );
  });

  it("should agree with computeRecipe per 100 g for the same totals and weight", () => {
    const original = chickenAndRice(1100);
    const snapshot = snapshotOf(original);

    expect(recipeOfSnapshot(snapshot).computed.per100g).toEqual(
      per100gOf(snapshot.total, snapshot.effectiveGrams),
    );
    expect(per100gOf(original.computed.total, original.computed.effectiveGrams)).toEqual(
      original.computed.per100g,
    );
  });

  it("should give 136.07 kcal per 100 g of an 1100 g cooked weight, the figure the recipe card gives", () => {
    const recipe = recipeOfSnapshot(snapshotOf(chickenAndRice(1100)));

    expect(recipe.computed.per100g.kcal).toBeCloseTo(136.0727, 4);
    expect(recipe.computed.per100g.kcal).toBe((1496.8 / 1100) * 100);
  });
});
