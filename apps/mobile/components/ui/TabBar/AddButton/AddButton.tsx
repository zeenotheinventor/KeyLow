import { View } from "react-native";

import { Icon } from "../../Icon";
import { PressableSurface } from "../../PressableSurface";

import type { AddButtonProps } from "./types";

/**
 * The centre of the tab bar: a filled accent circle with a plus. It is an action that opens the food
 * search sheet and has no screen of its own, so it is a button and never a tab.
 */
export function AddButton({ label, onPress, disabled = false }: AddButtonProps) {
  return (
    <View className="flex-1 items-center justify-center">
      <PressableSurface
        className={`h-[48px] w-[48px] items-center justify-center overflow-hidden rounded-pill bg-accent elevation-card ${disabled ? "opacity-40" : ""}`}
        disabled={disabled}
        label={label}
        onPress={onPress}
      >
        {/* The board draws the plus heavier than the design's stroke, 2.25 at 24 points. */}
        <Icon name="Plus" size="lg" strokeWidth={2.25} tone="accent-foreground" />
      </PressableSurface>
    </View>
  );
}
