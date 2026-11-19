import { describeStreakLine } from "@keylow/core/copy";
import { vars } from "nativewind";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, IconButton, Text } from "../../ui";

import type { DiaryHeaderProps } from "./types";

/**
 * The top of the diary, as the board draws it: the title (Today, or the day) and three 44 point icon buttons,
 * the assistant, which opens the chat sheet, the calendar, which opens the date picker, and more, which opens
 * the menu with Copy yesterday. The buttons are drawn without a press while the diary has not yet got its
 * time zone, because none could act on a day yet. The streak line sits under the title when there is one:
 * the board draws it on the title's row, which has no room for it beside the three buttons.
 */
export function DiaryHeader({
  title,
  assistantLabel,
  chooseDateLabel,
  moreLabel,
  streakLine,
  onAssistant,
  onChooseDate,
  onMore,
}: DiaryHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    // The inset is a runtime value no class can name, so it goes through a variable, as the tab screens' do.
    <View className="pt-[var(--inset-top)]" style={vars({ "--inset-top": insets.top })}>
      <View className="flex-row items-center gap-1 px-4 pb-3 pt-3">
        <Text className="min-w-0 flex-1" role="heading" variant="h1">
          {title}
        </Text>
        <IconButton icon="Sparkles" label={assistantLabel} onPress={onAssistant} />
        <IconButton icon="Calendar" label={chooseDateLabel} onPress={onChooseDate} />
        <IconButton icon="Ellipsis" label={moreLabel} onPress={onMore} />
      </View>
      {streakLine == null ? null : (
        <View className="-mt-2 flex-row items-center gap-[6px] px-4 pb-3">
          {streakLine.hasFlame ? <Icon name="Flame" size="sm" tone="warning-ink" /> : null}
          <Text tone={streakLine.isAtRisk ? "warning-ink" : "secondary"} variant="label-small">
            {describeStreakLine(streakLine.streakDays, streakLine.isAtRisk)}
          </Text>
        </View>
      )}
    </View>
  );
}
