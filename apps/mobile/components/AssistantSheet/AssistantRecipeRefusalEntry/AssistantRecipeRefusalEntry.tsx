import { describeRecipeRefusal } from "@keylow/core/copy";
import { View } from "react-native";

import { AssistantActionCard, Text } from "../../ui";

import type { AssistantRecipeRefusalEntryProps } from "./types";

/**
 * The card for an adjustment that could not be made (`assistant-card · recipe-compare`, refused): the recipe it
 * could not adjust, that no new recipe was made, and what a serving reaches against what was asked. A flat card
 * with the warning glyph and no action, because nothing was drawn up and nothing was written. Every word is core's,
 * from the figures the turn sent.
 */
export function AssistantRecipeRefusalEntry({ refusal }: AssistantRecipeRefusalEntryProps) {
  const { title, subtitle, body } = describeRecipeRefusal(refusal);

  return (
    <AssistantActionCard
      icon="TriangleAlert"
      iconTone="secondary"
      lead={
        <View className="px-3 pb-3">
          <Text tone="secondary">{body}</Text>
        </View>
      }
      subtitle={subtitle}
      title={title}
    />
  );
}
