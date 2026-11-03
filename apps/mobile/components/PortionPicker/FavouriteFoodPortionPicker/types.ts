import type { FoodPortionPickerProps } from "../types";

type WithoutFavouriteHeart<Props> = Props extends unknown ? Omit<Props, "favouriteHeart"> : never;

/** The food picker's props, less the heart, which this picker brings. */
export type FavouriteFoodPortionPickerProps = WithoutFavouriteHeart<FoodPortionPickerProps>;
