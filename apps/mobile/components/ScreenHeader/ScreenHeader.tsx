import { vars } from "nativewind";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "../ui";

import type { ScreenHeaderProps } from "./types";

/**
 * The title at the top of a tab's screen, drawn as the tab shell boards draw it: the screen's h1 with 16
 * points at its sides, 12 above it under the top inset, and 12 below. A screen's own control sits at the end
 * of the row, 12 points from the title.
 */
export function ScreenHeader({ title, trailing }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    // The inset is a runtime value no class can name, so it goes through a variable, as the sheet's does.
    <View className="pt-[var(--inset-top)]" style={vars({ "--inset-top": insets.top })}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-3">
        <Text className="min-w-0 flex-1" role="heading" variant="h1">
          {title}
        </Text>
        {trailing}
      </View>
    </View>
  );
}
