import { useFavouriteFoods, useToggleFavouriteFood } from "@keylow/api-client";

import { sheetHeaderHeight } from "../../components/ui";
import { useReadsEnabled } from "../useReadsEnabled";
import { useFavouriteHeart } from "./useFavouriteHeart";

import type { SheetHeaderControl } from "../../components/ui";
import type { Food } from "@keylow/core/schemas";

/** The heart of the food detail header, whose stack header the toast sits under. */
export function useFavouriteFoodHeart(food: Food): SheetHeaderControl {
  const favourites = useFavouriteFoods({ enabled: useReadsEnabled() });
  const { mutate } = useToggleFavouriteFood();

  return useFavouriteHeart({
    isFavourite: favourites.data?.some((favourite) => favourite.foodId === food.id) ?? false,
    isRead: favourites.isSuccess,
    headerHeight: sheetHeaderHeight.stack,
    toggle: (isFavourite, onError) => {
      mutate({ food, favourite: isFavourite }, { onError });
    },
  });
}
