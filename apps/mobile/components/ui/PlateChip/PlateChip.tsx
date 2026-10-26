import { describePlateChipName } from "@keylow/core/copy";
import { View } from "react-native";

import { Icon } from "../Icon";
import { PressableSurface } from "../PressableSurface";
import { Text } from "../Text";

import type { PlateChipProps } from "./types";

// A large text setting must not break the count onto a second line or push the title off centre, so the
// count grows only this far, as the macro strip's numbers do.
const maxFontScale = 1.2;

/**
 * The plate in the header: a Utensils icon and the number of foods on the plate, in a pill. Pressing it
 * opens Your plate. The pill is 36 points high inside a 44 point button, so the target is the full size.
 */
export function PlateChip({ count, onPress, disabled = false }: PlateChipProps) {
  return (
    <PressableSurface
      className={`h-touch-target justify-center ${disabled ? "opacity-40" : ""}`}
      disabled={disabled}
      label={describePlateChipName(count)}
      onPress={onPress}
    >
      <View className="h-control-sm flex-row items-center gap-[6px] rounded-pill border border-accent bg-accent-muted px-3">
        <Icon name="Utensils" size={18} tone="accent-ink" />
        <Text
          maxFontSizeMultiplier={maxFontScale}
          numberOfLines={1}
          tone="accent-ink"
          variant="body-strong"
        >
          {count}
        </Text>
      </View>
    </PressableSurface>
  );
}
