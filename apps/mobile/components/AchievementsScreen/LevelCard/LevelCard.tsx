import { ACHIEVEMENTS_SCREEN } from "@keylow/core/copy";
import { View } from "react-native";

import { Card, ProgressBar, Text } from "../../ui";

import type { LevelCardProps } from "./types";

/** The level and the points at the top of the Achievements screen, with the bar to the next level, as board 1 draws it. */
export function LevelCard({ level }: LevelCardProps) {
  return (
    <Card>
      <View className="gap-2.5">
        <View className="flex-row items-baseline justify-between">
          <View>
            <Text className="uppercase" tone="muted" variant="caption">
              {level.label}
            </Text>
            <Text variant="h2">{level.name}</Text>
          </View>
          <Text variant="numeral-small">
            {level.points} <Text tone="secondary">{ACHIEVEMENTS_SCREEN.pointsUnit}</Text>
          </Text>
        </View>
        <ProgressBar label={level.progressLabel} value={level.progressPercent} />
        <Text tone="muted" variant="caption">
          {level.pointsToNext}
        </Text>
      </View>
    </Card>
  );
}
