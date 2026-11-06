import { useFavouriteFoods, useToggleFavouriteFood } from "@keylow/api-client";

import { useFavouriteHeart } from "./useFavouriteHeart";

import type { IconButtonProps } from "@/components/ui/IconButton";
import type { Food } from "@keylow/core/schemas";

/** The heart of a food, or nothing while the food is not loaded yet. */
export function useFavouriteFoodHeart(food: Food | undefined): IconButtonProps | undefined {
  const favourites = useFavouriteFoods();
  const { mutateAsync } = useToggleFavouriteFood();
  const heart = useFavouriteHeart({
    isFavourite:
      food !== undefined && (favourites.data?.some((entry) => entry.foodId === food.id) ?? false),
    isRead: favourites.isSuccess,
    toggle: (isFavourite) =>
      food === undefined ? Promise.resolve() : mutateAsync({ food, favourite: isFavourite }),
  });

  return food === undefined ? undefined : heart;
}
