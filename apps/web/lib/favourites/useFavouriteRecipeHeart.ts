import { useFavouriteRecipes, useToggleFavouriteRecipe } from "@keylow/api-client";

import { useFavouriteHeart } from "./useFavouriteHeart";

import type { IconButtonProps } from "@/components/ui/IconButton";
import type { RecipeSummary } from "@keylow/api-client";

/** The heart of a recipe, or nothing while the recipe is not loaded yet. */
export function useFavouriteRecipeHeart(
  recipe: RecipeSummary | undefined,
): IconButtonProps | undefined {
  const favourites = useFavouriteRecipes();
  const { mutateAsync } = useToggleFavouriteRecipe();
  const heart = useFavouriteHeart({
    isFavourite:
      recipe !== undefined &&
      (favourites.data?.some((entry) => entry.recipeId === recipe.id) ?? false),
    isRead: favourites.isSuccess,
    toggle: (isFavourite) =>
      recipe === undefined ? Promise.resolve() : mutateAsync({ recipe, favourite: isFavourite }),
  });

  return recipe === undefined ? undefined : heart;
}
