import { useFavouriteRecipes, useToggleFavouriteRecipe } from "@keylow/api-client";
import { computeRecipe } from "@keylow/core/recipes";

import { sheetHeaderHeight } from "../../components/ui";
import { useReadsEnabled } from "../useReadsEnabled";
import { useFavouriteHeart } from "./useFavouriteHeart";

import type { RecipeViewRecipe } from "../../components/RecipeView";
import type { SheetHeaderControl } from "../../components/ui";

/** The heart of the recipe view header, whose sheet header the toast sits under. */
export function useFavouriteRecipeHeart(recipe: RecipeViewRecipe): SheetHeaderControl {
  const favourites = useFavouriteRecipes({ enabled: useReadsEnabled() });
  const { mutate } = useToggleFavouriteRecipe();

  return useFavouriteHeart({
    isFavourite: favourites.data?.some((favourite) => favourite.recipeId === recipe.id) ?? false,
    isRead: favourites.isSuccess,
    headerHeight: sheetHeaderHeight.sheet,
    toggle: (isFavourite, onError) => {
      // The list a new favourite joins holds the library's columns, which the view works out from the recipe it shows.
      const summary = {
        id: recipe.id,
        name: recipe.name,
        servings: recipe.servings,
        yield_grams: recipe.yield_grams,
        is_archived: recipe.is_archived,
        computed: computeRecipe({
          servings: recipe.servings,
          yieldGrams: recipe.yield_grams,
          ingredients: recipe.ingredients,
        }),
      };
      mutate({ recipe: summary, favourite: isFavourite }, { onError });
    },
  });
}
