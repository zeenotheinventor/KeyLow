import { Pressable, Text, View } from "react-native";

import type { FoodRowProps } from "./types";

export function FoodRow({
  name,
  brand,
  sourceLabel,
  energyText,
  isDisabled = false,
  statusText,
  onPress,
}: FoodRowProps) {
  const accessibleName = [name, brand, sourceLabel, energyText]
    .filter((part) => part !== null && part !== undefined)
    .join(", ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibleName}
      accessibilityState={{ disabled: isDisabled, busy: statusText !== undefined }}
      disabled={isDisabled}
      onPress={onPress}
      className="min-h-14 gap-1 rounded-lg border border-legacy-neutral-300 bg-legacy-neutral-50 px-4 py-3 disabled:opacity-50"
    >
      <Text className="text-base font-semibold text-legacy-neutral-900">{name}</Text>
      {brand === null ? null : <Text className="text-sm text-legacy-neutral-600">{brand}</Text>}
      <View className="flex-row items-center gap-2">
        {sourceLabel === undefined ? null : (
          <Text className="rounded-full bg-legacy-neutral-100 px-2 py-0.5 text-xs font-medium text-legacy-neutral-700">
            {sourceLabel}
          </Text>
        )}
        <Text className="text-sm text-legacy-neutral-500">{statusText ?? energyText}</Text>
      </View>
    </Pressable>
  );
}
