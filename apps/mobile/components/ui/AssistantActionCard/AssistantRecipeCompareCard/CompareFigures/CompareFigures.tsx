import { View } from "react-native";

import { Text } from "../../../Text";

import type { CompareFiguresProps } from "./types";

/**
 * The Per serving table of a compare card: a heading line with Before and After, then a row for each figure with
 * its name, what it was and what it is now, which is in the strong weight. Each row reads as one group, named for
 * its figure and both amounts.
 */
export function CompareFigures({ label, beforeLabel, afterLabel, figures }: CompareFiguresProps) {
  return (
    <View className="px-3">
      <View className="flex-row pb-[6px] pt-2">
        <Text className="flex-[1.3]" tone="secondary" variant="caption">
          {label}
        </Text>
        <Text className="flex-1 pl-2 text-right" tone="secondary" variant="caption">
          {beforeLabel}
        </Text>
        <Text className="flex-1 pl-2 text-right" tone="secondary" variant="caption">
          {afterLabel}
        </Text>
      </View>
      {figures.map((figure) => (
        <View
          accessible
          aria-label={`${figure.caption}, ${beforeLabel} ${figure.before}, ${afterLabel} ${figure.after}`}
          className="flex-row border-t border-border py-[6px]"
          key={figure.nutrient}
          role="group"
        >
          <Text className="flex-[1.3]" tone="secondary">
            {figure.caption}
          </Text>
          <Text className="flex-1 pl-2 text-right" tone="secondary">
            {figure.before}
          </Text>
          <Text className="flex-1 pl-2 text-right" variant="body-strong">
            {figure.after}
          </Text>
        </View>
      ))}
      <View className="h-2" />
    </View>
  );
}
