import { describeAssistantEmpty } from "@keylow/core";
import { ASSISTANT_NOT_MEDICAL_ADVICE, ASSISTANT_SHEET } from "@keylow/core/copy";
import { View } from "react-native";

import { GroupedList, ListRow, Text } from "../../ui";

import type { AssistantEmptyProps } from "./types";

/**
 * The empty sheet in the thread (`assistant · empty`): a heading, a line on how to say it, four starters
 * that each send their words, and the not-medical-advice line, which is shown here and on the consent card
 * only. Opened from Describe (`assistant · describe`) it is the Describe intro alone, with no starters and
 * no not-medical-advice line. Core says which words, and which parts, each way has.
 */
export function AssistantEmpty({ onStarterPress, isDisabled, describeAt }: AssistantEmptyProps) {
  const words = describeAssistantEmpty(describeAt);

  return (
    <View className="gap-4 pt-2">
      <View className="gap-1">
        <Text role="heading" variant="h2">
          {words.heading}
        </Text>
        <Text tone="secondary">{words.lede}</Text>
      </View>
      {words.starters.length === 0 ? null : (
        <GroupedList hidesTitle title={ASSISTANT_SHEET.startersLabel}>
          {words.starters.map((starter) => (
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
      )}
      {words.isNotMedicalLineShown ? (
        <Text tone="muted" variant="caption">
          {ASSISTANT_NOT_MEDICAL_ADVICE}
        </Text>
      ) : null}
    </View>
  );
}
