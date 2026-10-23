import { controlHeight, touchTarget } from "@keylow/tokens";
import { View } from "react-native";

import { Icon } from "../Icon";
import { PressableSurface } from "../PressableSurface";

import type { IconButtonProps, IconButtonSize, IconButtonVariant } from "./types";

// The classes are written out so Tailwind sees them. The secondary variant is the sheet header's
// close and create controls, the ghost variant is the scan control inside the search field, and the
// ring is the quiet plus on a food row. The primary variant is the accent circle with a plus, such as the
// Weight screen's add control.
const variantClassName: Record<IconButtonVariant, string> = {
  secondary: "border border-border bg-surface-raised",
  ghost: "bg-transparent",
  // The ring's border is drawn on the circle inside the touch target, not on the target.
  ring: "",
  primary: "",
};

// The card size is the board's 40 points, which no token names. It must match the h-[40px] class below.
const cardSize = 40;

const sizeClassName: Record<IconButtonSize, string> = {
  md: "h-control-md w-touch-target rounded-medium",
  sm: "h-control-sm w-control-sm rounded-small",
  card: "h-[40px] w-[40px] rounded-medium",
};

// The height each size is drawn at, which the reach to the 44 point touch target is worked out from.
const sizeHeight: Record<IconButtonSize, number> = {
  md: controlHeight.md,
  sm: controlHeight.sm,
  card: cardSize,
};

// A selected secondary button swaps its raised fill and border for the accent's, and its glyph for accent ink.
const selectedSecondaryClassName = "border border-accent bg-accent-muted";

// The ring and the primary variant have one shape whatever the size: a circle (32 points for the ring, 36
// for the primary) inside a 44 point touch target. The target is the pressable itself, because a touch
// outside a parent's bounds is never delivered, so a hit slop on a pressable inside a smaller parent could
// not reach out to 44.
const circleTargetClassName = "h-touch-target w-touch-target rounded-pill";
const circleClassName: Record<"ring" | "primary", string> = {
  ring: "h-8 w-8 items-center justify-center rounded-pill border border-border bg-transparent",
  primary: "h-[36px] w-[36px] items-center justify-center rounded-pill bg-accent",
};

// The primary plus is drawn heavier than the design's 1.75 stroke, as the board draws it.
const primaryStrokeWidth = 2.25;

export function IconButton({
  icon,
  iconSize = "md",
  label,
  variant = "secondary",
  size = "md",
  tone = "primary",
  isSelected = false,
  disabled = false,
  dimsWhenDisabled = true,
  haptic,
  onPress,
  ref,
  className = "",
}: IconButtonProps) {
  const isCircle = variant === "ring" || variant === "primary";
  const isSelectedSecondary = isSelected && variant === "secondary";
  const glyph =
    variant === "primary" ? (
      <Icon name={icon} size={iconSize} strokeWidth={primaryStrokeWidth} tone="accent-foreground" />
    ) : (
      <Icon
        name={icon}
        size={iconSize}
        tone={isSelectedSecondary ? "accent-ink" : variant === "ring" ? "secondary" : tone}
      />
    );

  return (
    <View className={className}>
      <PressableSurface
        className={`items-center justify-center overflow-hidden ${isCircle ? circleTargetClassName : sizeClassName[size]} ${isSelectedSecondary ? selectedSecondaryClassName : variantClassName[variant]} ${disabled && dimsWhenDisabled ? "opacity-40" : ""}`}
        disabled={disabled}
        haptic={haptic}
        // A control smaller than the touch target reaches out to it. The reach is invisible. A circle
        // is the touch target itself and needs none.
        hitSlop={isCircle ? undefined : (touchTarget - sizeHeight[size]) / 2}
        label={label}
        ref={ref}
        selected={isSelectedSecondary ? true : undefined}
        onPress={onPress}
      >
        {variant === "ring" || variant === "primary" ? (
          <View className={circleClassName[variant]}>{glyph}</View>
        ) : (
          glyph
        )}
      </PressableSurface>
    </View>
  );
}
