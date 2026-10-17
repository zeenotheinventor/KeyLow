import { RECIPE_EDITOR, describeCountSuffix } from "@keylow/core/copy";
import { View } from "react-native";

import { StepRow } from "../StepRow";
import { GroupedList, Icon, Text } from "../ui";

import type { RecipeViewStepsSectionProps } from "./types";

/**
 * The Instructions section of the recipe view: the heading with its count, the line that says the steps
 * are written for the recipe's own servings once the servings are scaled, and a card of read only steps.
 * The line is plain text read before step 1, not a live region.
 */
export function RecipeViewStepsSection({ steps, servingsNote }: RecipeViewStepsSectionProps) {
  return (
    <View className="gap-2">
      <View className="gap-1 px-1">
        <Text role="heading" variant="body-strong">
          {RECIPE_EDITOR.instructions}
          <Text tone="muted" variant="caption">
            {describeCountSuffix(steps.length)}
          </Text>
        </Text>
        {servingsNote === null ? null : (
          <View className="flex-row items-center gap-[6px]">
            <Icon name="Info" size="sm" tone="muted" />
            <Text className="shrink" tone="secondary" variant="caption">
              {servingsNote}
            </Text>
          </View>
        )}
      </View>
      <GroupedList hidesTitle title={RECIPE_EDITOR.instructions}>
        {steps.map((text, position) => (
          // Two steps can say the same thing, so the place in the method is the identity.
          <StepRow key={position} number={position + 1} text={text} />
        ))}
      </GroupedList>
    </View>
  );
}
