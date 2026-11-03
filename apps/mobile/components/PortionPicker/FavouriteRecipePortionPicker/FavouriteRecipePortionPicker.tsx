import { useFavouriteRecipeHeart } from "../../../lib/favourites";
import { PortionPicker } from "../PortionPicker";

import type { FavouriteRecipePortionPickerProps } from "./types";

/**
 * The amount step of a recipe with the favourite heart in its header, as the recipe view has. It is for the
 * pages a person reaches by tapping a recipe while logging.
 */
export function FavouriteRecipePortionPicker(props: FavouriteRecipePortionPickerProps) {
  const favouriteHeart = useFavouriteRecipeHeart(props.recipe);

  return <PortionPicker {...props} favouriteHeart={favouriteHeart} />;
}
