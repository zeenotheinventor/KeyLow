import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { haptic as hapticFeedback } from "../../../lib/haptics";
import { usePressScale } from "../../../lib/motion";
import { Icon } from "../Icon";
import { Text } from "../Text";
import { ButtonSpinner } from "./ButtonSpinner";

import type { ButtonProps, ButtonVariant } from "./types";
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

const variantTone: Record<ButtonVariant, Tone> = {
  primary: "accent-foreground",
  secondary: "primary",
  destructive: "on-status",
  ghost: "primary",
};

const sizeClassName = {
  md: "h-control-md px-4",
  lg: "h-control-lg px-5",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  haptic,
  onPress,
  className = "",
}: ButtonProps) {
  const { animatedStyle, isPressed, pressHandlers } = usePressScale();
  const isInert = disabled || loading;

  const handlePress = () => {
    if (haptic !== undefined) {
      void hapticFeedback[haptic]();
    }
    onPress?.();
  };

  // A class and an animated style cannot share an element: NativeWind merges the two and loses the
  // classes. So the press scale sits on its own wrapper with no class, the button with all its classes
  // is inside it, and the caller's layout classes are outside it.
  return (
    <View className={`${fullWidth ? "w-full" : ""} ${className}`} testID="button-layout">
      <Animated.View style={animatedStyle} testID="press-scale">
        <Pressable
          aria-busy={loading}
          aria-disabled={isInert}
          className={`min-w-touch-target flex-row items-center justify-center overflow-hidden rounded-medium border ${variantClassName[variant]} ${sizeClassName[size]} ${disabled ? "opacity-40" : ""}`}
          disabled={isInert}
          role="button"
          onPress={handlePress}
          {...pressHandlers}
        >
          {/* The press overlay is a layer with no meaning of its own, so it has no role to query by. */}
          {isPressed && !isInert ? (
            <View className="absolute inset-0 bg-press-overlay" testID="press-overlay" />
          ) : null}
          <View className={`flex-row items-center gap-2 ${loading ? "opacity-0" : ""}`}>
            {icon === undefined ? null : <Icon name={icon} tone={variantTone[variant]} />}
            <Text tone={variantTone[variant]} variant="body-strong">
              {children}
            </Text>
          </View>
          {loading ? <ButtonSpinner variant={variant} /> : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}
