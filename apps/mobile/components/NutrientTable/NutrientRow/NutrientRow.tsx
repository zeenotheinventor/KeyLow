import { NOT_GIVEN } from "@keylow/core/copy";
import { View } from "react-native";

import { Text } from "../../ui";

import type { NutrientRowProps } from "./types";

/** One nutrient: its name at the left and its value at the right, which is quieter when it is not given. */
export function NutrientRow({ label, value, isFirst }: NutrientRowProps) {
  return (
    <View
      accessible
      aria-label={`${label}: ${value ?? NOT_GIVEN}`}
      role="listitem"
      className={`min-h-touch-target flex-row items-center justify-between gap-3 px-4 py-[10px] ${isFirst ? "" : "border-t border-border"}`}
    >
      <Text tone="secondary">{label}</Text>
      {value === null ? (
        <Text tone="muted">{NOT_GIVEN}</Text>
      ) : (
        <Text variant="body-strong">{value}</Text>
      )}
    </View>
  );
}
