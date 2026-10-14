import { FOOD_DETAIL } from "@keylow/core/copy";
import { View } from "react-native";

import { PortionRow } from "./PortionRow";
import { Card, Text } from "../../ui";

import type { PortionListProps } from "./types";

/** The portion sizes a food comes in, under a heading, the default one marked. */
export function PortionList({ portions }: PortionListProps) {
  return (
    <View className="gap-2">
      <Text className="px-1" role="heading" variant="body-strong">
        {FOOD_DETAIL.portions}
      </Text>
      {/* The rows bring their own padding, so the card has none. */}
      <Card aria-label={FOOD_DETAIL.portions} padding={0} role="list">
        {portions.map((portion, index) => (
          <PortionRow key={portion.id} isFirst={index === 0} portion={portion} />
        ))}
      </Card>
    </View>
  );
}
