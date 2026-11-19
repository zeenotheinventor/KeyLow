import { View } from "react-native";

import { Text } from "../../ui";
import { BadgeTile } from "../BadgeTile";

import type { CategorySectionProps } from "./types";

/** One category of the catalogue: its heading with how many are earned, then its badges four to a row, as board 1 draws it. */
export function CategorySection({ category, onOpenBadge }: CategorySectionProps) {
  return (
    <View className="gap-3">
      <View className="flex-row items-baseline justify-between pt-1">
        <Text role="heading" variant="h2">
          {category.title}
        </Text>
        <Text tone="muted" variant="caption">
          {category.countText}
        </Text>
      </View>
      <View className="-mx-1 flex-row flex-wrap">
        {category.badges.map((badge) => (
          <View key={badge.id} className="w-1/4 px-1 pb-3">
            <BadgeTile
              badge={badge}
              onPress={() => {
                onOpenBadge(badge.id);
              }}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
