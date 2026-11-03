import { ASSISTANT_NOT_MEDICAL_ADVICE, ASSISTANT_SHEET } from "@keylow/core/copy";
import { View } from "react-native";

import { GroupedList, ListRow, Text } from "../../ui";

import type { AssistantEmptyProps } from "./types";

/**
 * The empty sheet in the thread (`assistant · empty`): a heading, a line on how to say it, four starters
 * that each send their words, and the not-medical-advice line, which is shown here and on the consent card
 * only.
 */
export function AssistantEmpty({ onStarterPress, isDisabled }: AssistantEmptyProps) {
  return (
    <View className="gap-4 pt-2">
      <View className="gap-1">
        <Text role="heading" variant="h2">
          {ASSISTANT_SHEET.emptyHeading}
        </Text>
        <Text tone="secondary">{ASSISTANT_SHEET.emptyLede}</Text>
      </View>
      <GroupedList hidesTitle title={ASSISTANT_SHEET.startersLabel}>
        {ASSISTANT_SHEET.starters.map((starter) => (
          <ListRow
            disabled={isDisabled}
            key={starter}
            title={starter}
            trailingIcon="ArrowUp"
            onPress={() => {
              onStarterPress(starter);
            }}
          />
        ))}
      </GroupedList>
      <Text tone="muted" variant="caption">
        {ASSISTANT_NOT_MEDICAL_ADVICE}
      </Text>
    </View>
  );
}
