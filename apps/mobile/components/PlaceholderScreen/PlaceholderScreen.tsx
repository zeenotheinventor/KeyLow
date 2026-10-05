import { Text, View } from "react-native";

import type { PlaceholderScreenProps } from "./types";

export function PlaceholderScreen({ title, children }: PlaceholderScreenProps) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-neutral-50 px-6">
      <Text accessibilityRole="header" className="text-3xl font-semibold text-neutral-900">
        {title}
      </Text>
      <Text className="text-base text-neutral-500">Coming soon</Text>
      {children}
    </View>
  );
}
