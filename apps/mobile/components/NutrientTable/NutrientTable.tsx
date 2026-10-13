import { Text, View } from "react-native";

import { NUTRIENT_ROWS } from "./nutrientRows";
import { formatAmount } from "../../lib/formatAmount";

import type { NutrientTableProps } from "./types";
import type { NutrientBasis } from "@keylow/core/schemas";

const BASIS_HEADINGS: Record<NutrientBasis, string> = {
  per_100g: "Nutrition per 100 g",
  per_100ml: "Nutrition per 100 ml",
};

export function NutrientTable({ food }: NutrientTableProps) {
  return (
    <View className="gap-2">
      <Text accessibilityRole="header" className="text-lg font-semibold text-legacy-neutral-900">
        {BASIS_HEADINGS[food.basis]}
      </Text>
      <View>
        {NUTRIENT_ROWS.map((row) => {
          const amount = food[row.field];
          // A missing value is never shown as 0, which would read as a real measurement.
          const valueText = amount === null ? "not given" : `${formatAmount(amount)} ${row.unit}`;
          return (
            <View
              key={row.field}
              accessible
              accessibilityLabel={`${row.label}: ${valueText}`}
              className="min-h-11 flex-row items-center justify-between border-b border-legacy-neutral-200"
            >
              <Text className="text-base text-legacy-neutral-900">{row.label}</Text>
              <Text
                className={
                  amount === null
                    ? "text-base text-legacy-neutral-500"
                    : "text-base text-legacy-neutral-900"
                }
              >
                {valueText}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
