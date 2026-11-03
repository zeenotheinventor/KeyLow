import { useFavouriteFoodHeart } from "../../../lib/favourites";
import { sheetHeaderHeight } from "../../ui";
import { PortionPicker } from "../PortionPicker";

import type { FavouriteFoodPortionPickerProps } from "./types";

/**
 * The portion picker of a food with the favourite heart in its header, as the food detail has. It is for the
 * pages a person reaches by tapping a food while logging: the heart is a hook on the food, so a page that has no
 * food of its own to favourite, such as a logged entry's, uses the plain picker.
 */
export function FavouriteFoodPortionPicker(props: FavouriteFoodPortionPickerProps) {
  const favouriteHeart = useFavouriteFoodHeart(props.food, sheetHeaderHeight.sheet);

  return <PortionPicker {...props} favouriteHeart={favouriteHeart} />;
}
