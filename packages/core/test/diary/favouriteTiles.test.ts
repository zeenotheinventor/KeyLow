import { describe, expect, it } from "vitest";

import { favouriteTiles } from "../../src/diary";
import { computeRecipe } from "../../src/recipes";
import { buildChickenAndRiceRecipe } from "../../src/testing";

import type { LoggableRecipe } from "../../src/diary";
import type { RecipeComputed } from "../../src/recipes";

type FavouriteRecipeInput = {
  recipeId: string;
  createdAt: string;
  recipe: LoggableRecipe & { computed: RecipeComputed };
};

const food = (foodId: string, name: string, createdAt: string) => ({
  foodId,
  createdAt,
  food: { name },
});

const recipe = (recipeId: string, name: string, createdAt: string): FavouriteRecipeInput => {
  const { servings, ingredients } = buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 });
  return {
    recipeId,
    createdAt,
    recipe: {
      id: recipeId,
      name,
      servings,
      yield_grams: 1100,
      computed: computeRecipe({ servings, yieldGrams: 1100, ingredients }),
    },
  };
};

describe("favouriteTiles", () => {
  it("should merge foods and recipes with the newest favourite first", () => {
    const tiles = favouriteTiles({
      foods: [
        food("f2", "Porridge", "2026-11-02T10:00:00+00:00"),
        food("f1", "Banana", "2026-10-01T10:00:00+00:00"),
      ],
      recipes: [recipe("r1", "Overnight oats", "2026-11-01T10:00:00+00:00")],
    });

    expect(tiles.map((tile) => [tile.kind, tile.id, tile.name])).toEqual([
      ["food", "f2", "Porridge"],
      ["recipe", "r1", "Overnight oats"],
      ["food", "f1", "Banana"],
    ]);
  });

  it("should compare moments, not strings, when the offsets differ", () => {
    const tiles = favouriteTiles({
      foods: [food("f1", "Banana", "2026-11-01T10:00:00+00:00")],
      recipes: [recipe("r1", "Overnight oats", "2026-11-01T14:00:00+05:00")],
    });

    // 14:00 at +05:00 is 09:00 UTC, an hour before the food, though its text sorts after.
    expect(tiles.map((tile) => tile.id)).toEqual(["f1", "r1"]);
  });

  it("should put a recipe before a food favourited at the same moment", () => {
    const tiles = favouriteTiles({
      foods: [food("f1", "Banana", "2026-11-01T10:00:00+00:00")],
      recipes: [recipe("r1", "Overnight oats", "2026-11-01T10:00:00+00:00")],
    });

    expect(tiles.map((tile) => tile.id)).toEqual(["r1", "f1"]);
  });

  it("should leave out a recipe that cannot be logged", () => {
    const unloggable = recipe("r1", "Overnight oats", "2026-11-01T10:00:00+00:00");
    unloggable.recipe.computed = {
      ...unloggable.recipe.computed,
      perServing: { ...unloggable.recipe.computed.perServing, kcal: null },
    };

    expect(
      favouriteTiles({
        foods: [food("f1", "Banana", "2026-10-01T10:00:00+00:00")],
        recipes: [unloggable],
      }).map((tile) => tile.id),
    ).toEqual(["f1"]);
  });

  it("should give no tiles when there are no favourites", () => {
    expect(favouriteTiles({ foods: [], recipes: [] })).toEqual([]);
  });
});
