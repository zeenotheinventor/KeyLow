import { useFavouriteFoods, useToggleFavouriteFood } from "@keylow/api-client";

import { sheetHeaderHeight } from "../../components/ui";
import { useReadsEnabled } from "../useReadsEnabled";
import { useFavouriteHeart } from "./useFavouriteHeart";

import type { SheetHeaderControl } from "../../components/ui";
import type { Food } from "@keylow/core/schemas";

/**
 * The heart of a food's header, whose toast sits under that header. The food detail's is the stack header, which
 * is the default, and the portion picker's is the sheet header.
 */
export function useFavouriteFoodHeart(
  food: Food,
  headerHeight: number = sheetHeaderHeight.stack,
): SheetHeaderControl {
  const favourites = useFavouriteFoods({ enabled: useReadsEnabled() });
  const { mutateAsync } = useToggleFavouriteFood();

  return useFavouriteHeart({
    isFavourite: favourites.data?.some((favourite) => favourite.foodId === food.id) ?? false,
    isRead: favourites.isSuccess,
    headerHeight,
    toggle: (isFavourite) => mutateAsync({ food, favourite: isFavourite }),
  });
}
