import { Pressable, Text, View } from "react-native";

import type { BasisChoiceProps } from "./types";
import type { NutrientBasis } from "@keylow/core/schemas";

const BASIS_OPTIONS: readonly { value: NutrientBasis; label: string }[] = [
  { value: "per_100g", label: "Per 100 g" },
  { value: "per_100ml", label: "Per 100 ml" },
];

export function BasisChoice({ value, onChange }: BasisChoiceProps) {
  return (
    <View className="gap-1">
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="text-sm font-medium text-legacy-neutral-700"
      >
        Nutrition basis
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Nutrition basis"
        className="flex-row gap-2"
      >
        {BASIS_OPTIONS.map((option) => {
          const isSelected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: isSelected }}
              onPress={() => {
                onChange(option.value);
              }}
              className={
                isSelected
                  ? "h-12 flex-1 items-center justify-center rounded-lg border border-legacy-brand-600 bg-legacy-brand-600"
                  : "h-12 flex-1 items-center justify-center rounded-lg border border-legacy-neutral-300 bg-legacy-neutral-50"
              }
            >
              <Text
                className={
                  isSelected
                    ? "text-base font-semibold text-legacy-neutral-50"
                    : "text-base font-semibold text-legacy-neutral-900"
                }
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
