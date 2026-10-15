import { FOOD_DETAIL } from "@keylow/core/copy";
import { formatPortionAmount } from "@keylow/core/format";
import { View } from "react-native";

import { Badge, Text } from "../../../ui";

import type { PortionRowProps } from "./types";

/** One portion: its name, a Default badge when it is the default one, and its amount in grams or millilitres. */
export function PortionRow({ portion, isFirst }: PortionRowProps) {
  const amount = formatPortionAmount(portion);
  const label = [
    portion.label,
    amount === null ? null : `${amount.amount} ${amount.unit}`,
    portion.is_default ? FOOD_DETAIL.defaultPortion : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    // A leaf row with no control inside, so it is one accessibility element. GroupedList's wrapper is not,
    // because its rows hold buttons.
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
