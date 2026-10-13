import { DATA_SOURCE_ATTRIBUTION, requiresConfirmation } from "@keylow/core/foods";
import { Pressable, ScrollView, Text, View } from "react-native";

import { foodSourceLabel } from "../../lib/foodSourceLabel";
import { formatAmount } from "../../lib/formatAmount";
import { NutrientTable, describeNutrientField } from "../NutrientTable";

import type { FoodDetailProps } from "./types";
import type { FoodPortion } from "@keylow/core/schemas";

// A portion has exactly one of grams and ml, so the last case is only there for the type.
function describePortionAmount(portion: FoodPortion): string {
  if (portion.grams !== null) {
    return `${formatAmount(portion.grams)} g`;
  }
  return portion.ml === null ? "" : `${formatAmount(portion.ml)} ml`;
}

function describePortion(portion: FoodPortion): string {
  const parts = [portion.label, describePortionAmount(portion)];
  return (portion.is_default ? [...parts, "default"] : parts).join(", ");
}

export function FoodDetail({ food, portions, onEdit, onReview }: FoodDetailProps) {
  const { source } = food;
  const missingFields = food.quality.fields_missing ?? [];

  return (
    <ScrollView contentContainerClassName="gap-6 px-6 py-6" className="flex-1 bg-legacy-neutral-50">
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-2xl font-semibold text-legacy-neutral-900">
          {food.name}
        </Text>
        {food.brand === null ? null : (
          <Text className="text-base text-legacy-neutral-600">{food.brand}</Text>
        )}
        <Text className="text-sm text-legacy-neutral-500">{`Source: ${foodSourceLabel(source)}`}</Text>
      </View>

      {source === "user" ? (
        <Pressable
          accessibilityRole="button"
          onPress={onEdit}
          className="h-12 items-center justify-center rounded-lg border border-legacy-neutral-300"
        >
          <Text className="text-base font-semibold text-legacy-neutral-900">Edit</Text>
        </Pressable>
      ) : null}

      {requiresConfirmation(food) ? (
        <View className="gap-3 rounded-lg border border-legacy-warning-600 bg-legacy-warning-50 p-4">
          <Text
            accessibilityRole="header"
            className="text-lg font-semibold text-legacy-warning-900"
          >
            Some values are missing
          </Text>
          {missingFields.length === 0 ? null : (
            <View accessibilityRole="list" accessibilityLabel="Missing values" className="gap-1">
              {missingFields.map((field) => (
                <Text key={field} className="text-base text-legacy-warning-900">
                  {describeNutrientField(field)}
                </Text>
              ))}
            </View>
          )}
          <Text className="text-base text-legacy-warning-900">
            Fill in the blank fields before you save your own copy of this food.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onReview}
            className="h-12 items-center justify-center rounded-lg bg-legacy-brand-600"
          >
            <Text className="text-base font-semibold text-legacy-neutral-50">
              Review and save as my food
            </Text>
          </Pressable>
        </View>
      ) : null}

      <NutrientTable food={food} />
      {food.quality.carbs_convention === "us_total" ? (
        <Text className="text-sm text-legacy-neutral-600">
          Carbohydrate includes fibre (US labelling convention).
        </Text>
      ) : null}

      {portions.length === 0 ? null : (
        <View className="gap-2">
          <Text
            accessibilityRole="header"
            className="text-lg font-semibold text-legacy-neutral-900"
          >
            Portions
          </Text>
          <View accessibilityRole="list" accessibilityLabel="Portion sizes">
            {portions.map((portion) => (
              <View
                key={portion.id}
                accessible
                accessibilityLabel={describePortion(portion)}
                className="min-h-11 flex-row items-center justify-between border-b border-legacy-neutral-200"
              >
                <Text className="text-base text-legacy-neutral-900">{portion.label}</Text>
                <View className="flex-row items-center gap-2">
                  {portion.is_default ? (
                    <Text className="rounded-full bg-legacy-neutral-100 px-2 py-0.5 text-xs font-medium text-legacy-neutral-700">
                      Default
                    </Text>
                  ) : null}
                  <Text className="text-base text-legacy-neutral-500">
                    {describePortionAmount(portion)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {source === "user" ? null : (
        <View className="gap-1 border-t border-legacy-neutral-200 pt-4">
          <Text className="text-sm text-legacy-neutral-500">
            {DATA_SOURCE_ATTRIBUTION[source].text}
          </Text>
          <Text className="text-sm text-legacy-neutral-500">
            {DATA_SOURCE_ATTRIBUTION[source].url}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
