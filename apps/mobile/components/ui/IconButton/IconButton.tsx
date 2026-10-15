import { controlHeight, touchTarget } from "@keylow/tokens";
import { View } from "react-native";

import { Icon } from "../Icon";
import { PressableSurface } from "../PressableSurface";

import type { IconButtonProps, IconButtonSize, IconButtonVariant } from "./types";

// The classes are written out so Tailwind sees them. The secondary variant is the sheet header's
// close and create controls, the ghost variant is the scan control inside the search field, and the
// ring is the quiet plus on a food row.
const variantClassName: Record<IconButtonVariant, string> = {
  secondary: "border border-border bg-surface-raised",
  ghost: "bg-transparent",
  // The ring's border is drawn on the circle inside the touch target, not on the target.
  ring: "",
};

const sizeClassName: Record<IconButtonSize, string> = {
  md: "h-control-md w-touch-target rounded-medium",
  sm: "h-control-sm w-control-sm rounded-small",
};

// The ring has one shape whatever the size: a 32 point circle inside a 44 point touch target. The
// target is the pressable itself, because a touch outside a parent's bounds is never delivered, so
// a hit slop on a pressable inside a 32 point parent could not reach out to 44.
const ringTargetClassName = "h-touch-target w-touch-target rounded-pill";
const ringCircleClassName =
  "h-8 w-8 items-center justify-center rounded-pill border border-border bg-transparent";

export function IconButton({
  icon,
  iconSize = "md",
  label,
  variant = "secondary",
  size = "md",
  disabled = false,
  dimsWhenDisabled = true,
  haptic,
  onPress,
  className = "",
}: IconButtonProps) {
  const isRing = variant === "ring";
  const glyph = <Icon name={icon} size={iconSize} tone={isRing ? "secondary" : "primary"} />;

  return (
    <View className={className}>
      <PressableSurface
        className={`items-center justify-center overflow-hidden ${isRing ? ringTargetClassName : sizeClassName[size]} ${variantClassName[variant]} ${disabled && dimsWhenDisabled ? "opacity-40" : ""}`}
        disabled={disabled}
        haptic={haptic}
        // A control smaller than the touch target reaches out to it. The reach is invisible. The ring
        // is the touch target itself and needs none.
        hitSlop={isRing ? undefined : (touchTarget - controlHeight[size]) / 2}
        label={label}
        onPress={onPress}
      >
        {isRing ? <View className={ringCircleClassName}>{glyph}</View> : glyph}
      </PressableSurface>
    </View>
  );
}
