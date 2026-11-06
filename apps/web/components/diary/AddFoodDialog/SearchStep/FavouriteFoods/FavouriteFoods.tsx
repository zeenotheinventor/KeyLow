import { useFavouriteFoods, useFavouriteRecipes, useRecentFoods } from "@keylow/api-client";
import { FAVOURITES_STRIP } from "@keylow/core/copy";
import { favouriteTiles } from "@keylow/core/diary";
import { useId } from "react";

import { FavouriteTile } from "../FavouriteTile";

import type { FavouriteFoodsProps } from "./types";
import type { KeyboardEvent } from "react";

import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";

const SKELETON_TILE_COUNT = 6;

// A read that has no data and never will: it failed, or it is waiting for a connection with nothing cached.
function isUnreadable(read: { data: unknown; isError: boolean; fetchStatus: string }) {
  return read.data === undefined && (read.isError || read.fetchStatus === "paused");
}

// The arrow keys move between the tiles, as Tab does, so a keyboard reaches every tile of a strip that
// scrolls. The browser scrolls a tile into view when it takes the focus.
function moveFocusWithArrows(event: KeyboardEvent<HTMLButtonElement>) {
  const item = event.currentTarget.closest("li");
  const neighbour =
    event.key === "ArrowRight"
      ? item?.nextElementSibling
      : event.key === "ArrowLeft"
        ? item?.previousElementSibling
        : null;
  const next = neighbour?.querySelector("button");
  if (next) {
    event.preventDefault();
    next.focus();
  }
}

/**
 * The Favourites strip of the idle search, between Quick add and Recent: round tiles for the foods and
 * recipes the user has favourited, newest first, scrolling sideways to the dialog's edge, with the last one
 * cut there to say so. Nothing is drawn when there are no favourites, nor when a read failed or is waiting
 * for a connection with nothing cached, so Recent is never held up by it and the skeleton is never endless.
 * A food opens at the amount last logged when Recent holds it, as the phone's does.
 */
export function FavouriteFoods({ onOpenFood, onOpenRecent, onOpenRecipe }: FavouriteFoodsProps) {
  const headingId = useId();
  const foods = useFavouriteFoods();
  const recipes = useFavouriteRecipes();
  const recent = useRecentFoods();

  if (isUnreadable(foods) || isUnreadable(recipes)) {
    return null;
  }

  const isLoading = foods.data === undefined || recipes.data === undefined;
  const favouriteFoods = foods.data ?? [];
  const favouriteRecipes = recipes.data ?? [];
  const tiles = isLoading
    ? []
    : favouriteTiles({ foods: favouriteFoods, recipes: favouriteRecipes });
  if (!isLoading && tiles.length === 0) {
    return null;
  }

  // What a tile does is made from the favourite it was made from, so a tile never looks its favourite up
  // again. A food opens at the amount last logged when Recent holds it, as the phone's does.
  const presses = new Map<string, () => void>();
  for (const { recipeId, recipe } of favouriteRecipes) {
    presses.set(`recipe-${recipeId}`, () => {
      onOpenRecipe(recipe);
    });
  }
  for (const { foodId } of favouriteFoods) {
    presses.set(`food-${foodId}`, () => {
      const lastLogged = recent.data?.find((entry) => entry.foodId === foodId);
      if (lastLogged === undefined) {
        onOpenFood(foodId);
      } else {
        onOpenRecent(lastLogged);
      }
    });
  }

  return (
    // The dialog's body pads its content by 20 pixels, and the strip runs on to the dialog's right edge.
    <section aria-labelledby={headingId} className="-mr-5 flex flex-col gap-2">
      <div className="flex min-h-[32px] items-center px-1">
        <h2 id={headingId} className="text-body-strong">
          {FAVOURITES_STRIP.heading}
        </h2>
      </div>
      {isLoading ? (
        <Skeleton label="Loading favourites" className="min-h-[72px]">
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: SKELETON_TILE_COUNT }, (_, index) => (
              <div
                // The tiles are identical placeholders, so their position is their identity.
                key={index}
                className="flex w-[72px] shrink-0 flex-col items-center gap-1"
              >
                <SkeletonBone className="size-[52px] rounded-full" />
                <SkeletonBone className="mt-1 h-2.5 w-14" />
              </div>
            ))}
          </div>
        </Skeleton>
      ) : (
        <ul className="flex gap-3 overflow-x-auto pr-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tiles.map((tile) => (
            <li key={`${tile.kind}-${tile.id}`} className="shrink-0">
              <FavouriteTile
                kind={tile.kind}
                name={tile.name}
                onKeyDown={moveFocusWithArrows}
                onPress={() => {
                  presses.get(`${tile.kind}-${tile.id}`)?.();
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
