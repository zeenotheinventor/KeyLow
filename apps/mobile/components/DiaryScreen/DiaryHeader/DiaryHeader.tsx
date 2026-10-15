import { vars } from "nativewind";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconButton, Text } from "../../ui";

import type { DiaryHeaderProps } from "./types";

/**
 * The top of the diary, as the board draws it: the title (Today, or the day) and two 44 point icon buttons,
 * the calendar, which opens the date picker, and more, which opens the menu with Copy yesterday. The
 * buttons are drawn without a press while the diary has not yet got its time zone, because neither could
 * act on a day yet.
 */
export function DiaryHeader({
  title,
  chooseDateLabel,
  moreLabel,
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
        <IconButton icon="Calendar" label={chooseDateLabel} onPress={onChooseDate} />
        <IconButton icon="Ellipsis" label={moreLabel} onPress={onMore} />
      </View>
    </View>
  );
}
