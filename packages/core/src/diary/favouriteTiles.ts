import { canLogRecipe } from "./canLogRecipe";

import type { LoggableRecipe } from "./recipeSnapshotQuantity";
import type { RecipeComputed } from "../recipes/schemas";

export type FavouriteFoodInput = {
  foodId: string;
  createdAt: string;
  food: { name: string };
};

export type FavouriteRecipeInput = {
  recipeId: string;
  createdAt: string;
  recipe: LoggableRecipe & { computed: Pick<RecipeComputed, "perServing"> };
};

/** One tile of the Favourites strip: a food or a recipe, by the id its amount step opens with. */
export type FavouriteTile = {
  kind: "food" | "recipe";
  id: string;
  name: string;
};

/**
 * The tiles of the Favourites strip: the favourite foods and the favourite recipes the diary can log, in
 * one list with the one favourited most recently first. At the same moment a recipe comes before a food,
 * because a whole recipe matters more than a single food. A recipe that cannot be logged has no amount step
 * to open, so it has no tile.
 */
export const favouriteTiles = ({
  foods,
  recipes,
}: {
  foods: readonly FavouriteFoodInput[];
  recipes: readonly FavouriteRecipeInput[];
}): FavouriteTile[] => {
  const ranked = [
    ...recipes
      .filter(({ recipe }) => canLogRecipe(recipe))
      .map(({ recipeId, createdAt, recipe }) => ({
        moment: Date.parse(createdAt),
        tile: { kind: "recipe", id: recipeId, name: recipe.name } satisfies FavouriteTile,
      })),
    ...foods.map(({ foodId, createdAt, food }) => ({
      moment: Date.parse(createdAt),
      tile: { kind: "food", id: foodId, name: food.name } satisfies FavouriteTile,
    })),
  ];

  // The sort is stable and the recipes were listed first, so a tie keeps the recipe ahead.
  return ranked.sort((first, second) => second.moment - first.moment).map(({ tile }) => tile);
};
