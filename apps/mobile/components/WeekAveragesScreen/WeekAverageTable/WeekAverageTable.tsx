import { View } from "react-native";

import { NutrientRow } from "../../NutrientTable/NutrientRow";
import { Card, Text } from "../../ui";

import type { WeekAverageTableProps } from "./types";

/** One of the week's tables, drawn as a food's nutrition is: a heading over a card of rows. */
export function WeekAverageTable({ heading, rows }: WeekAverageTableProps) {
  return (
    <View className="gap-2">
      <Text className="px-1" role="heading" variant="body-strong">
        {heading}
      </Text>
      {/* The rows bring their own padding, so the card has none. */}
      <Card aria-label={heading} padding={0} role="list">
        {rows.map((row, index) => (
          <NutrientRow key={row.label} isFirst={index === 0} label={row.label} value={row.value} />
        ))}
      </Card>
    </View>
  );
}
