import { Text as NativeText, View } from "react-native";

import { Text, useGroupedRowPosition } from "../ui";

import type { StepRowProps } from "./types";

/**
 * One step of a recipe's method, read only: the number in a circle and the full text beside it, with no
 * chevron and nothing to press. It sits in a `GroupedList`, which tells it whether it is the first row.
 */
export function StepRow({ number, text }: StepRowProps) {
  const { isFirst } = useGroupedRowPosition();

  return (
    // One element for a screen reader, which reads the number and then the step.
    <View
      accessible
      className={`min-h-[52px] flex-row items-start gap-3 p-3 ${isFirst ? "" : "border-t border-border"}`}
    >
      <View className="h-6 w-6 shrink-0 items-center justify-center rounded-pill border border-border bg-surface-raised">
        {/* The board draws the number at weight 600 over 12 points, which no kit text variant is, so it is written as the toast's action is. */}
        <NativeText className="text-[12px] font-semibold leading-4 tabular-nums text-text-primary">
          {number}
        </NativeText>
      </View>
      <Text className="min-w-0 flex-1">{text}</Text>
    </View>
  );
}
