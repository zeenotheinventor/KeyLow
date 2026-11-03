import {
  summaryOfStoredRecipe,
  useFavouriteRecipes,
  useToggleFavouriteRecipe,
} from "@keylow/api-client";

import { sheetHeaderHeight } from "../../components/ui";
import { useReadsEnabled } from "../useReadsEnabled";
import { useFavouriteHeart } from "./useFavouriteHeart";

import type { RecipeViewRecipe } from "../../components/RecipeView";
import type { SheetHeaderControl } from "../../components/ui";

/** The heart of the recipe view header, whose sheet header the toast sits under. */
export function useFavouriteRecipeHeart(recipe: RecipeViewRecipe): SheetHeaderControl {
  const favourites = useFavouriteRecipes({ enabled: useReadsEnabled() });
  const { mutateAsync } = useToggleFavouriteRecipe();

  return useFavouriteHeart({
    isFavourite: favourites.data?.some((favourite) => favourite.recipeId === recipe.id) ?? false,
    isRead: favourites.isSuccess,
    headerHeight: sheetHeaderHeight.sheet,
    toggle: (isFavourite) =>
      mutateAsync({ recipe: summaryOfStoredRecipe(recipe), favourite: isFavourite }),
  });
}
