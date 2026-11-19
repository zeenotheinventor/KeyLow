import { ACHIEVEMENTS_SCREEN, describeBackfillCard } from "@keylow/core/copy";
import { View } from "react-native";

import { Button, Card, Icon, Text } from "../../ui";

import type { BackfillCardProps } from "./types";

/**
 * The one summary card of the badges a person already had when achievements arrived, at the top of the
 * Dashboard, as board 3 draws it: an accent border, the trophy, what was earned, then See your badges and
 * Dismiss. It shows no toast and no notification, and it is shown once, so a screen hides it for good.
 */
export function BackfillCard({ badgeCount, level, onSeeBadges, onDismiss }: BackfillCardProps) {
  return (
    <Card border="accent">
      <View className="gap-3">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-full border-2 border-accent bg-surface-raised">
            <Icon name="Trophy" tone="accent-ink" />
          </View>
          <View className="flex-1">
            <Text role="heading" variant="body-strong">
              {ACHIEVEMENTS_SCREEN.backfill.title}
            </Text>
            <Text tone="secondary" variant="caption">
              {describeBackfillCard(badgeCount, level)}
            </Text>
          </View>
        </View>
        <View className="flex-row gap-2">
          <Button className="flex-1" onPress={onSeeBadges}>
            {ACHIEVEMENTS_SCREEN.backfill.seeBadges}
          </Button>
          <Button variant="ghost" onPress={onDismiss}>
            {ACHIEVEMENTS_SCREEN.backfill.dismiss}
          </Button>
        </View>
      </View>
    </Card>
  );
}
