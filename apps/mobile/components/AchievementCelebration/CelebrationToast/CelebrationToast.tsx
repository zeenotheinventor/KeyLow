import { ACHIEVEMENT_CELEBRATION } from "@keylow/core/copy";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AchievementBadge, Text, Toast } from "../../ui";

import type { CelebrationToastProps } from "./types";
import type { ToastChip } from "../../ui";

const chipTones = {
  points: "accent",
  freeze: "protein",
  level: "accent",
} as const satisfies Record<
  CelebrationToastProps["summary"]["chips"][number]["kind"],
  ToastChip["tone"]
>;

/**
 * The unlock toast of board 3, drawn from one summary: the kit's achievement toast with the medal for one
 * badge or the count for several, the words, the freeze and level chips and View. It closes itself after
 * 4 seconds, or on a swipe down, and View closes it too.
 */
export function CelebrationToast({ summary, onView, onClose }: CelebrationToastProps) {
  const { bottom } = useSafeAreaInsets();
  const isSingle = summary.ids.length === 1;

  return (
    <Toast
      actionLabel={ACHIEVEMENT_CELEBRATION.viewAction}
      bottomInset={bottom}
      chips={summary.chips.map(({ kind, label }) => ({ label, tone: chipTones[kind] }))}
      description={summary.body}
      medal={
        isSingle ? (
          <AchievementBadge decorative id={summary.leadId} size={44} />
        ) : (
          <View className="h-11 w-11 items-center justify-center rounded-full border-2 border-text-secondary">
            <Text tone="secondary" variant="body-strong">
              {String(summary.ids.length)}
            </Text>
          </View>
        )
      }
      message={summary.title}
      variant="achievement"
      onAction={() => {
        onView();
        onClose();
      }}
      onClose={onClose}
    />
  );
}
