import { View } from "react-native";

import { Text } from "../../../Text";

import type { TargetFiguresProps } from "./types";

/**
 * The Per serving strip of a suggested recipe: a caption, then a column for each figure with its small
 * numeral, and under it "Asked" with what the person named. The "Asked" caption turns to the warning ink for a
 * figure that missed. Each column reads as one group, named for its caption, its figure and what was asked.
 */
export function TargetFigures({ label, figures }: TargetFiguresProps) {
  return (
    <View className="gap-2 px-3 pb-3">
      <Text tone="secondary" variant="caption">
        {label}
      </Text>
      <View className="flex-row gap-2">
        {figures.map((figure) => (
          <View
            accessible
            aria-label={[figure.caption, figure.value, figure.asked].filter(Boolean).join(", ")}
            className="min-w-0 flex-1 gap-[2px]"
            key={figure.nutrient}
            role="group"
          >
            <Text tone="secondary" variant="caption">
              {figure.caption}
            </Text>
            <Text variant="numeral-small">{figure.value}</Text>
            {figure.asked === null ? null : (
              <Text tone={figure.isMiss ? "warning-ink" : "muted"} variant="caption">
                {figure.asked}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
