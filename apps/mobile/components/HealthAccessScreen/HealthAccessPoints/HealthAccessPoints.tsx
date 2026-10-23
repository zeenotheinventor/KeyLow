import { Text as NativeText, View } from "react-native";

import { Icon, Text } from "../../ui";

import type { HealthAccessPointsProps } from "./types";

/**
 * The explain state's card: each point is a tick, its title and its text, with a hairline between them.
 * The board draws a hairline under the last point as well, which doubles the card's own border, so the
 * hairline here sits above every point but the first.
 */
export function HealthAccessPoints({ points }: HealthAccessPointsProps) {
  return (
    // A plain surface and not the kit's Card, whose elevation the board does not draw on this list.
    <View className="overflow-hidden rounded-large border border-border bg-surface" role="list">
      {points.map((point, index) => (
        <View
          key={point.title}
          accessible
          className={`flex-row gap-3 px-4 py-3 ${index === 0 ? "" : "border-t border-border"}`}
          role="listitem"
        >
          {/* The tick sits 2 points below the top of the title, as the board draws it. */}
          <View className="mt-[2px]">
            <Icon name="Check" size={18} strokeWidth={2} tone="accent-ink" />
          </View>
          <View className="flex-1">
            <Text variant="label-small">{point.title}</Text>
            <NativeText className="text-label-small font-normal tabular-nums text-text-secondary">
              {point.text}
            </NativeText>
          </View>
        </View>
      ))}
    </View>
  );
}
