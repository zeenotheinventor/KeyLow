import {
  FOODS_TO_AVOID,
  describeAvoidedFoodName,
  describeRemoveAvoidedFood,
} from "@keylow/core/copy";
import { View } from "react-native";

import { Badge, IconButton, Text } from "../../ui";

import type { AvoidedFoodRowProps } from "./types";

/**
 * One food on the Foods to avoid list (`settings · foods-to-avoid`): its name, its kind as a badge, danger
 * for an allergy and neutral for a dislike, and a Remove button named for the food.
 */
export function AvoidedFoodRow({ label, kind, hasDivider, onRemove }: AvoidedFoodRowProps) {
  return (
    <View
      className={`min-h-[56px] flex-row items-center gap-3 px-3 py-2 ${hasDivider ? "border-t border-border" : ""}`}
    >
      <Text className="flex-1" variant="body-strong">
        {describeAvoidedFoodName(label)}
      </Text>
      <Badge tone={kind === "allergy" ? "danger" : "neutral"}>
        {kind === "allergy" ? FOODS_TO_AVOID.allergy : FOODS_TO_AVOID.dislike}
      </Badge>
      <IconButton
        icon="X"
        label={describeRemoveAvoidedFood(label)}
        tone="secondary"
        variant="ghost"
        onPress={onRemove}
      />
    </View>
  );
}
