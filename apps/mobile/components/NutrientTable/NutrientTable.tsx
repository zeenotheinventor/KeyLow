import { describeNutritionHeading, nutrientRows } from "@keylow/core/copy";
import { View } from "react-native";

import { NutrientRow } from "./NutrientRow";
import { Card, Text } from "../ui";

import type { NutrientTableProps } from "./types";

/** The nutrition of a food per 100 g or 100 ml, as the boards draw it: a heading over a card of rows. */
export function NutrientTable({ food, note }: NutrientTableProps) {
  const heading = describeNutritionHeading(food.basis);

  return (
    <View className="gap-2">
      <Text className="px-1" role="heading" variant="body-strong">
        {heading}
      </Text>
      {/* The rows bring their own padding, so the card has none. */}
      <Card aria-label={heading} padding={0} role="list">
        {nutrientRows(food).map((row, index) => (
          <NutrientRow key={row.label} isFirst={index === 0} label={row.label} value={row.value} />
        ))}
      </Card>
      {note === undefined ? null : (
        <Text className="px-1" tone="secondary" variant="caption">
          {note}
        </Text>
      )}
    </View>
  );
}
