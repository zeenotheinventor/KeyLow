import type { RecipeViewRecipe } from "../../RecipeView";
import type { RecipeEditPlatePickerProps, RecipeToPlatePickerProps } from "../types";

type WithoutFavouriteHeart<Props> = Props extends unknown ? Omit<Props, "favouriteHeart"> : never;

/** The recipe amount step's props, less the heart, which this picker brings. The recipe is a stored one. */
export type FavouriteRecipePortionPickerProps = WithoutFavouriteHeart<
  RecipeToPlatePickerProps | RecipeEditPlatePickerProps
> & { recipe: RecipeViewRecipe };
