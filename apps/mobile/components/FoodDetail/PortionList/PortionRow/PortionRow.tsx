import { FOOD_DETAIL } from "@keylow/core/copy";
import { formatGrams } from "@keylow/core/format";
import { View } from "react-native";

import { Badge, Text } from "../../../ui";

import type { PortionRowProps } from "./types";
import type { FoodPortion } from "@keylow/core/schemas";

// A portion has exactly one of grams and ml, so the last case is only there for the type.
function portionAmount(portion: FoodPortion): { amount: string; unit: "g" | "ml" } | null {
  if (portion.grams !== null) {
    return { amount: formatGrams(portion.grams), unit: "g" };
  }
  return portion.ml === null ? null : { amount: formatGrams(portion.ml), unit: "ml" };
}

/** One portion: its name, a Default badge when it is the default one, and its amount in grams or millilitres. */
export function PortionRow({ portion, isFirst }: PortionRowProps) {
  const amount = portionAmount(portion);
  const label = [
    portion.label,
    amount === null ? null : `${amount.amount} ${amount.unit}`,
    portion.is_default ? FOOD_DETAIL.defaultPortion : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View
      accessible
      aria-label={label}
      role="listitem"
      className={`min-h-[56px] flex-row items-center gap-2 px-4 py-2 ${isFirst ? "" : "border-t border-border"}`}
    >
      <Text className="shrink" variant="body-strong">
        {portion.label}
      </Text>
      {portion.is_default ? (
        // The badge aligns itself to the start, which would pin it to the top of the row.
        <View className="self-center">
          <Badge>{FOOD_DETAIL.defaultPortion}</Badge>
        </View>
      ) : null}
      {amount === null ? null : (
        <View className="ml-auto flex-row items-baseline gap-[3px]">
          <Text variant="numeral-small">{amount.amount}</Text>
          <Text tone="muted" variant="caption">
            {amount.unit}
          </Text>
        </View>
      )}
    </View>
  );
}
