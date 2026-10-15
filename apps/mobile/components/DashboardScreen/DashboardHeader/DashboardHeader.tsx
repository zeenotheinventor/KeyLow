import { vars } from "nativewind";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "../../ui";

import type { DashboardHeaderProps } from "./types";

/**
 * The top of the dashboard, as the board draws it: today's date in the muted caption over the screen's
 * title. The date's line keeps its 16 points while the date is not known yet, so the title does not move
 * when it arrives.
 */
export function DashboardHeader({ eyebrow, title }: DashboardHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    // The inset is a runtime value no class can name, so it goes through a variable, as the tab screens' do.
    <View className="pt-[var(--inset-top)]" style={vars({ "--inset-top": insets.top })}>
      <View className="gap-[2px] px-4 pb-3 pt-3">
        <View className="min-h-[16px]">
          {eyebrow === undefined ? null : (
            <Text tone="muted" variant="caption">
              {eyebrow}
            </Text>
          )}
        </View>
        <Text role="heading" variant="h1">
          {title}
        </Text>
      </View>
    </View>
  );
}
