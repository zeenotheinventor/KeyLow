import { controlHeight, touchTarget } from "@keylow/tokens";
import { View } from "react-native";

import { Icon } from "../Icon";
import { PressableSurface } from "../PressableSurface";

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
  iconSize = "md",
  label,
  variant = "secondary",
  size = "md",
  disabled = false,
  haptic,
  onPress,
  className = "",
}: IconButtonProps) {
  return (
    <View className={className}>
      <PressableSurface
        className={`items-center justify-center overflow-hidden ${sizeClassName[size]} ${variantClassName[variant]} ${disabled ? "opacity-40" : ""}`}
        disabled={disabled}
        haptic={haptic}
        // A control smaller than the touch target reaches out to it. The reach is invisible.
        hitSlop={(touchTarget - controlHeight[size]) / 2}
        label={label}
        onPress={onPress}
      >
        <Icon name={icon} size={iconSize} />
      </PressableSurface>
    </View>
  );
}
