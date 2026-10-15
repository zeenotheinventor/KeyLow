import { vars } from "nativewind";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconButton, Text } from "../../ui";

import type { DiaryHeaderProps } from "./types";

/**
 * The top of the diary, as the board draws it: the title (Today, or the day) and two 44 point icon buttons,
 * the calendar and more. Both are drawn and not wired: the date picker and the menu with Copy yesterday
 * belong to the food log interactions ticket.
 */
export function DiaryHeader({ title, chooseDateLabel, moreLabel }: DiaryHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    // The inset is a runtime value no class can name, so it goes through a variable, as the tab screens' do.
    <View className="pt-[var(--inset-top)]" style={vars({ "--inset-top": insets.top })}>
      <View className="flex-row items-center gap-1 px-4 pb-3 pt-3">
        <Text className="min-w-0 flex-1" role="heading" variant="h1">
          {title}
        </Text>
        <IconButton icon="Calendar" label={chooseDateLabel} />
        <IconButton icon="Ellipsis" label={moreLabel} />
      </View>
    </View>
  );
}
