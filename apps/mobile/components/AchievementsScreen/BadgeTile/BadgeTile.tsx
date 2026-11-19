import { View } from "react-native";

import { AchievementBadge, PressableSurface, ProgressBar, Text } from "../../ui";

import type { BadgeTileProps } from "./types";

/**
 * One badge in a category's grid, as board 1 draws it: the badge at 56, its name, and under it the tier of an earned
 * badge or the progress line and bar of a locked one. A hidden badge shows ??? and nothing else. The press opens its
 * detail, and the whole tile is named by the badge's label, so the badge itself is decoration.
 */
export function BadgeTile({ badge, onPress }: BadgeTileProps) {
  return (
    <PressableSurface label={badge.label} role="button" onPress={onPress}>
      <View className="items-center gap-1.5">
        <AchievementBadge decorative id={badge.id} size={56} state={badge.state} />
        <Text className="text-center" variant="caption">
          {badge.name}
        </Text>
        {badge.progressPercent === null ? null : (
          <View className="w-14">
            <ProgressBar label={badge.label} value={badge.progressPercent} />
          </View>
        )}
        {badge.progressText === null ? null : (
          <Text className="text-center" tone="muted" variant="caption">
            {badge.progressText}
          </Text>
        )}
        {badge.caption === null ? null : (
          <Text className="text-center" tone="muted" variant="caption">
            {badge.caption}
          </Text>
        )}
      </View>
    </PressableSurface>
  );
}
