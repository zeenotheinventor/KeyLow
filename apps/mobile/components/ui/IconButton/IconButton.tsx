import { controlHeight, touchTarget } from "@keylow/tokens";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { haptic as hapticFeedback } from "../../../lib/haptics";
import { usePressScale } from "../../../lib/motion";
import { Icon } from "../Icon";

import type { IconButtonProps, IconButtonSize, IconButtonVariant } from "./types";

// The classes are written out so Tailwind sees them. The secondary variant is the sheet header's
// close and create controls, the ghost variant is the scan control inside the search field.
const variantClassName: Record<IconButtonVariant, string> = {
  secondary: "border border-border bg-surface-raised",
  ghost: "bg-transparent",
};

const sizeClassName: Record<IconButtonSize, string> = {
  md: "h-control-md w-touch-target rounded-medium",
  sm: "h-control-sm w-control-sm rounded-small",
};

export function IconButton({
  icon,
  label,
  variant = "secondary",
  size = "md",
  disabled = false,
  haptic,
  onPress,
  className = "",
}: IconButtonProps) {
  const { animatedStyle, isPressed, pressHandlers } = usePressScale();

  const handlePress = () => {
    if (haptic !== undefined) {
      void hapticFeedback[haptic]();
    }
    onPress?.();
  };

  // A class and an animated style cannot share an element, so the press scale sits on its own wrapper.
  // See Button.
  return (
    <View className={className}>
      <Animated.View style={animatedStyle} testID="press-scale">
        <Pressable
          aria-label={label}
          aria-disabled={disabled}
          className={`items-center justify-center overflow-hidden ${sizeClassName[size]} ${variantClassName[variant]} ${disabled ? "opacity-40" : ""}`}
          disabled={disabled}
          // A control smaller than the touch target reaches out to it. The reach is invisible.
          hitSlop={(touchTarget - controlHeight[size]) / 2}
          role="button"
          onPress={handlePress}
          {...pressHandlers}
        >
          {/* The press overlay is a layer with no meaning of its own, so it has no role to query by. */}
          {isPressed && !disabled ? (
            <View className="absolute inset-0 bg-press-overlay" testID="press-overlay" />
          ) : null}
          <Icon name={icon} />
        </Pressable>
      </Animated.View>
    </View>
  );
}
