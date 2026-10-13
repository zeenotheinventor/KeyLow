import { Text, View } from "react-native";

import type { FoodLoadStateProps } from "./types";

/** What a screen shows in place of a food that is loading, failed to load or does not exist. */
export function FoodLoadState({ state }: FoodLoadStateProps) {
  if (state === "error") {
    return (
      <View className="flex-1 bg-legacy-neutral-50 px-6 py-6">
        <Text accessibilityRole="alert" className="text-base text-legacy-danger-600">
          The food could not be loaded. Try again later.
        </Text>
      </View>
    );
  }

  if (state === "loading") {
    return (
      <View className="flex-1 bg-legacy-neutral-50 px-6 py-6">
        <Text accessibilityLiveRegion="polite" className="text-base text-legacy-neutral-500">
          Loading food
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 gap-2 bg-legacy-neutral-50 px-6 py-6">
      <Text accessibilityRole="header" className="text-2xl font-semibold text-legacy-neutral-900">
        Food not found
      </Text>
      <Text className="text-base text-legacy-neutral-500">
        This food does not exist, or you cannot see it.
      </Text>
    </View>
  );
}
