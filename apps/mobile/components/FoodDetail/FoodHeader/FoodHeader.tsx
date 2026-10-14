import { View } from "react-native";

import { Badge, Text } from "../../ui";

import type { FoodHeaderProps } from "./types";

/** The food's name as the screen's heading, with where it comes from and its brand under it. */
export function FoodHeader({ food }: FoodHeaderProps) {
  return (
    <View className="gap-2">
      <Text role="heading" variant="h1">
        {food.name}
      </Text>
      <View className="flex-row flex-wrap items-center gap-2">
        {/* The badge aligns itself to the start, which would pin it to the top of a line with the brand beside it. */}
        <View className="self-center">
          <Badge kind="source" source={food.source} />
        </View>
        {food.brand === null ? null : <Text tone="secondary">{food.brand}</Text>}
      </View>
    </View>
  );
}
