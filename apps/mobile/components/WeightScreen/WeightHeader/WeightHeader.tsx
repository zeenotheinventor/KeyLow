import { WEIGHT_SCREEN } from "@keylow/core/copy";
import { vars } from "nativewind";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconButton, Text } from "../../ui";

import type { WeightHeaderProps } from "./types";

/**
 * The top of the Weight screen as `weight: chart and weigh-ins` draws it: the back control, 4 points from
 * the title at the start of the row, with 8 points at the sides and below. Its other controls, the add
 * button and the trend explainer's, are added by the screens they open.
 */
export function WeightHeader({ onBack }: WeightHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    // The inset is a runtime value no class can name, so it goes through a variable, as the tab screens' do.
    <View className="pt-[var(--inset-top)]" style={vars({ "--inset-top": insets.top })}>
      <View className="flex-row items-center gap-1 px-2 pb-2">
        <IconButton
          icon="ChevronLeft"
          iconSize="lg"
          label={WEIGHT_SCREEN.backLabel}
          variant="ghost"
          onPress={onBack}
        />
        <Text className="min-w-0 flex-1" role="heading" variant="h2">
          {WEIGHT_SCREEN.title}
        </Text>
      </View>
    </View>
  );
}
