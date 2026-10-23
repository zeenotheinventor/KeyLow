import { View } from "react-native";

import { Text } from "../../ui";

import type { LastTrainedBlockProps } from "./types";

/** When the muscle was last trained, under a hairline: the day and the routine day, then the exercises that worked it. */
export function LastTrainedBlock({ lastTrained }: LastTrainedBlockProps) {
  return (
    <View className="gap-[2px] border-t border-border pt-3">
      <Text tone="muted" variant="caption">
        {lastTrained.label}
      </Text>
      <Text variant="body-strong">{lastTrained.value}</Text>
      {lastTrained.exercises === null ? null : (
        <Text tone="secondary" variant="caption">
          {lastTrained.exercises}
        </Text>
      )}
    </View>
  );
}
