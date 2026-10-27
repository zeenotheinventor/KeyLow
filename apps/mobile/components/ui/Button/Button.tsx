import { controlHeight, touchTarget } from "@keylow/tokens";
import { View } from "react-native";

import { Icon } from "../Icon";
import { PressableSurface } from "../PressableSurface";
import { Text } from "../Text";
import { ButtonSpinner } from "./ButtonSpinner";

import type { ButtonProps, ButtonSize, ButtonVariant } from "./types";
import type { IconSizeName } from "../Icon";
import type { TextVariant } from "../Text";
import type { Tone } from "../tone";

// The classes are written out so Tailwind sees them. A variant sets its fill and its 1 point border,
// so every variant is the same size. Where the design has no border it is transparent, and on a fill
// it is the fill's own colour: a transparent border on Android leaves the fill about a pixel short of
// the edge on each side, where the design's fill runs to the edge.
const variantClassName: Record<ButtonVariant, string> = {
  primary: "border-accent bg-accent",
  secondary: "border-border bg-surface-raised",
  destructive: "border-danger bg-danger",
  ghost: "border-transparent bg-transparent",
};

const variantTone: Record<ButtonVariant, ButtonTone> = {
  primary: "accent-foreground",
  secondary: "primary",
  destructive: "on-status",
  ghost: "primary",
};

// What a label and its icon can be written in: the variant's own tone, or the danger tone of the ghost and secondary buttons, or the ghost button's accent ink.
type ButtonTone = Tone | "danger" | "accent-ink";

// Medium and large are the design system card's: a body strong label, 8 between an icon and it. The small
// button follows the food form boards' Remove, which the card does not draw: a 14 over 20 label, 8 across
// the box, 6 between the icon and the label, and a 16 point icon.
const sizeLook: Record<
  ButtonSize,
  {
    boxClassName: string;
    rowClassName: string;
    labelVariant: TextVariant;
    iconSize: IconSizeName | number;
  }
> = {
  sm: {
    boxClassName: "h-control-sm px-2",
    rowClassName: "gap-[6px]",
    labelVariant: "label-small",
    iconSize: 16,
  },
  md: {
    boxClassName: "h-control-md px-4",
    rowClassName: "gap-2",
    labelVariant: "body-strong",
    iconSize: "md",
  },
  lg: {
    boxClassName: "h-control-lg px-5",
    rowClassName: "gap-2",
    labelVariant: "body-strong",
    iconSize: "md",
  },
};

// The small button is 36 points high, so it reaches the 44 point touch target by taking the rest as hit
// slop above and below. Its width is already the touch target's, through its minimum width.
const smallSlop = (touchTarget - controlHeight.sm) / 2;
const smallHitSlop = { top: smallSlop, bottom: smallSlop };

export function Button({
  children,
  variant = "primary",
  size = "md",
  quiet = false,
  tone: requestedTone,
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityLabel,
  icon,
  leading,
  haptic,
  onPress,
  className = "",
}: ButtonProps) {
  const look = sizeLook[size];
  const isDanger = requestedTone === "danger" && (variant === "ghost" || variant === "secondary");
  const isGhostAccentInk = variant === "ghost" && requestedTone === "accent-ink";
  const tone = isDanger
    ? "danger"
    : isGhostAccentInk
      ? "accent-ink"
      : variant === "ghost" && quiet
        ? "secondary"
        : variantTone[variant];
  const hasLeading = leading !== undefined;

  // The press scale sits on a wrapper inside the layout view, with the button and all its classes inside
  // that, so the caller's layout classes are outside the scale. See PressableSurface.
  return (
    <View className={`${fullWidth ? "w-full" : ""} ${className}`} testID="button-layout">
      <PressableSurface
        busy={loading}
        className={`min-w-touch-target flex-row items-center justify-center overflow-hidden rounded-medium border ${variantClassName[variant]} ${look.boxClassName} ${disabled ? "opacity-40" : ""}`}
        disabled={disabled}
        haptic={haptic}
        hitSlop={size === "sm" ? smallHitSlop : undefined}
        label={accessibilityLabel}
        onPress={onPress}
      >
        {/* Loading hides the label with opacity, and Fabric draws a view at full opacity and no style as no view
            at all. A row that came and went with `loading` moved its label between two parents, which crashed
            Android (KEY-733), so the row is always a view of its own and only its opacity changes. */}
        <View
          className={`flex-row items-center ${hasLeading ? "gap-3" : look.rowClassName} ${loading ? "opacity-0" : ""}`}
          collapsable={false}
          testID="button-row"
        >
          {hasLeading ? (
            leading
          ) : icon === undefined ? null : (
            <Icon name={icon} size={look.iconSize} tone={tone} />
          )}
          <Text tone={tone} variant={look.labelVariant}>
            {children}
          </Text>
        </View>
        {loading ? <ButtonSpinner isDanger={isDanger} variant={variant} /> : null}
      </PressableSurface>
    </View>
  );
}
