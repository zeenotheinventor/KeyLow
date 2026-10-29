import { vars } from "nativewind";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconButton, Text } from "../ui";

import type { ScreenHeaderProps } from "./types";

/**
 * The title at the top of a tab's screen, drawn as the tab shell boards draw it: the screen's h1 with 16
 * points at its sides, 12 above it under the top inset, and 12 below. A screen's own control sits at the end
 * of the row, 12 points from the title. A screen pushed inside a tab has its back control before the title,
 * drawn as the Weight screen's is: a ghost chevron 4 points from the title, with 8 points at the start.
 */
export function ScreenHeader({ title, trailing, back }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    // The inset is a runtime value no class can name, so it goes through a variable, as the sheet's does.
    <View className="pt-[var(--inset-top)]" style={vars({ "--inset-top": insets.top })}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-3">
        {back === undefined ? null : (
          <IconButton
            className="-ml-2 -mr-2"
            icon="ChevronLeft"
            iconSize="lg"
            label={back.label}
            variant="ghost"
            onPress={back.onPress}
          />
        )}
        <Text className="min-w-0 flex-1" role="heading" variant="h1">
          {title}
        </Text>
        {trailing}
      </View>
    </View>
  );
}
