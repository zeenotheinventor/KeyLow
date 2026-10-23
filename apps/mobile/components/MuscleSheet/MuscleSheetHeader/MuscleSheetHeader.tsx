import { BODY_MAP } from "@keylow/core/copy";
import { View } from "react-native";

import { IconButton, Text } from "../../ui";

import type { MuscleSheetHeaderProps } from "./types";

/**
 * The sheet's own header, which stands in for a title: the muscle's name as the heading, the line under it,
 * and the Close button at the end.
 */
export function MuscleSheetHeader({ title, subtitle, onClose }: MuscleSheetHeaderProps) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="flex-1 gap-[2px]">
        <View accessible role="heading">
          <Text variant="h2">{title}</Text>
        </View>
        {subtitle === null ? null : (
          <Text tone="secondary" variant="caption">
            {subtitle}
          </Text>
        )}
      </View>
      <IconButton icon="X" label={BODY_MAP.closeSheet} variant="ghost" onPress={onClose} />
    </View>
  );
}
