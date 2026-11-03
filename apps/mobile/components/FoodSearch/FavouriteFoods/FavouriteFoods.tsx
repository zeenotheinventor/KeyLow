import { useFavouriteFoods, useFavouriteRecipes } from "@keylow/api-client";
import { FAVOURITES_STRIP } from "@keylow/core/copy";
import { favouriteTiles } from "@keylow/core/diary";
import { ScrollView, View } from "react-native";

import { useReadsEnabled } from "../../../lib/useReadsEnabled";
import { Skeleton, Text } from "../../ui";
import { FavouriteTile } from "../FavouriteTile";

import type { FavouriteFoodsProps } from "./types";

/**
 * The Favourites strip of the log search, between Quick add and Recent: round tiles for the foods and recipes
 * the user has favourited, newest first, scrolling sideways with the last one cut at the right edge to say so.
 * Nothing is drawn when there are no favourites, and nothing when a read fails, so Recent is never held up by
 * it. Nothing is read until the account has accepted the current Terms.
 */
export function FavouriteFoods({ onOpenFood, onOpenRecipe }: FavouriteFoodsProps) {
  const isEnabled = useReadsEnabled();
  const foods = useFavouriteFoods({ enabled: isEnabled });
  const recipes = useFavouriteRecipes({ enabled: isEnabled });

  const hasFailed =
    (foods.isError && foods.data === undefined) || (recipes.isError && recipes.data === undefined);
  if (hasFailed) {
    return null;
  }

  const isLoading = foods.data === undefined || recipes.data === undefined;
  const tiles = isLoading ? [] : favouriteTiles({ foods: foods.data, recipes: recipes.data });
  if (!isLoading && tiles.length === 0) {
    return null;
  }

  return (
    <View className="gap-2">
      <Text className="min-h-[32px] px-1" role="heading" variant="body-strong">
        {FAVOURITES_STRIP.heading}
      </Text>
      {/* The sheet gives its list 16 points at each side, and the strip runs to the screen's edge. */}
      <View className="-mx-4">
        {isLoading ? (
          <Skeleton variant="favourites" />
        ) : (
          <ScrollView
            contentContainerClassName="gap-3 px-4"
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
          >
            {tiles.map((tile) => (
              <FavouriteTile
                key={`${tile.kind}-${tile.id}`}
                kind={tile.kind}
                name={tile.name}
                onPress={() => {
                  if (tile.kind === "recipe") {
                    onOpenRecipe(tile.id);
                  } else {
                    onOpenFood(tile.id);
                  }
                }}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
