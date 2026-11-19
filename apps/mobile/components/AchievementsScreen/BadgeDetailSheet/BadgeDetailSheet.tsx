import { ACHIEVEMENTS_SCREEN } from "@keylow/core/copy";
import { View } from "react-native";

import { AchievementBadge, Badge, BottomSheet, Button, ProgressBar, Text } from "../../ui";
import { FactTile } from "../FactTile";

import type { BadgeDetailSheetProps } from "./types";
import type { BadgeTone } from "../../ui";
import type { BadgePillStyle } from "@keylow/core";

// The pill takes the tier's colour as the medallions on board 1 do: bronze the warning colour, silver the
// plain grey, gold the carbs gold and platinum the accent. A hidden badge's pill is plain grey. The kit badge
// takes no class, and its neutral fill is the sheet's own colour where board 2 draws surface-raised, so the
// plain pills take the kit's hairline outline to stay visible on the sheet.
const pillLook: Record<BadgePillStyle, { tone: BadgeTone; outlined: boolean }> = {
  bronze: { tone: "warning", outlined: false },
  silver: { tone: "neutral", outlined: true },
  gold: { tone: "carbs", outlined: false },
  platinum: { tone: "accent", outlined: false },
  hidden: { tone: "neutral", outlined: true },
};

/**
 * The bottom sheet of one badge, as board 2 draws it. Earned says when and what it was worth, locked says how far
 * the person is, what it is worth and what comes with it, and hidden keeps its secret. Done closes it.
 */
export function BadgeDetailSheet({ open, onClose, detail }: BadgeDetailSheetProps) {
  return (
    <BottomSheet label={detail.sheetLabel} open={open} onClose={onClose}>
      <View className="items-center gap-3.5">
        <AchievementBadge decorative id={detail.id} size={96} state={detail.state} />
        {/* The kit badge is self-start, so a wrapper centres it under the medal as the board draws it. */}
        <View className="self-center">
          <Badge {...pillLook[detail.pillStyle]}>{detail.pill}</Badge>
        </View>
        <Text role="heading" variant="h1">
          {detail.title}
        </Text>
        <Text className="text-center" tone="secondary">
          {detail.description}
        </Text>
        {detail.progress === null ? null : (
          <View className="w-full gap-2">
            <ProgressBar label={`${detail.title} progress`} value={detail.progress.percent} />
            <View className="flex-row justify-between">
              <Text tone="muted" variant="caption">
                {detail.progress.text}
              </Text>
              <Text tone="muted" variant="caption">
                {detail.progress.remainingText}
              </Text>
            </View>
          </View>
        )}
        {detail.facts.length === 0 ? null : (
          <View className="w-full flex-row gap-2">
            {detail.facts.map((fact) => (
              <FactTile key={fact.label} label={fact.label} value={fact.value} />
            ))}
          </View>
        )}
        <Button fullWidth size="lg" variant="secondary" onPress={onClose}>
          {ACHIEVEMENTS_SCREEN.detail.done}
        </Button>
      </View>
    </BottomSheet>
  );
}
