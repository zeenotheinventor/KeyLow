import { describeLogFavouriteName } from "@keylow/core/copy";
import { View } from "react-native";

import { Icon, PressableSurface, Text } from "../../ui";

import type { FavouriteTileProps } from "./types";

/**
 * One favourite of the log search's strip, as the favourites board draws it: a 54 point circle with the food
 * icon (Utensils) or the recipe icon (ChefHat), and the name under it on one line, cut with an ellipsis when
 * it is long. The tile is 72 points wide, so the circle is a full touch target.
 */
export function FavouriteTile({ kind, name, onPress }: FavouriteTileProps) {
  return (
    <PressableSurface
      className="w-[72px] items-center gap-2"
      label={describeLogFavouriteName(name)}
      onPress={onPress}
    >
      <View className="h-[54px] w-[54px] items-center justify-center rounded-full border border-border bg-surface-raised">
        <Icon name={kind === "recipe" ? "ChefHat" : "Utensils"} size="lg" tone="secondary" />
      </View>
      <Text className="w-full text-center" numberOfLines={1} tone="secondary" variant="caption">
        {name}
      </Text>
    </PressableSurface>
  );
}
