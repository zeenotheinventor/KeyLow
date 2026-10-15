import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { haptic as hapticFeedback } from "../../../lib/haptics";
import { usePressScale } from "../../../lib/motion";

import type { PressableSurfaceProps } from "./types";

/**
 * What every pressable primitive shares: the press scale, the press overlay, the optional haptic and
 * the accessibility state. A button, an icon button, a row and a text button are each this surface
 * with their own look in `className` and their own contents.
 */
export function PressableSurface({
  children,
  label,
  role = "button",
  selected,
  checked,
  busy,
  disabled = false,
  hitSlop,
  haptic,
  pressScale,
  accessibilityActions,
  onAccessibilityAction,
  onPress,
  className = "",
}: PressableSurfaceProps) {
  const { animatedStyle, isPressed, pressHandlers, resetPress } = usePressScale(pressScale);
  const isInert = disabled || busy === true;

  // A pressable that goes inert under the finger never gets its release, so the press is let go here.
  useEffect(() => {
    if (isInert) {
      resetPress();
    }
  }, [isInert, resetPress]);

  const handlePress = () => {
    if (haptic !== undefined) {
      void hapticFeedback[haptic]();
    }
    onPress?.();
  };

  // A class and an animated style cannot share an element: NativeWind merges the two and loses the
  // classes. So the press scale sits on its own wrapper with no class, and the pressable with all its
  // classes is inside it.
  return (
    <Animated.View style={animatedStyle} testID="press-scale">
      <Pressable
        accessibilityActions={accessibilityActions}
        aria-busy={busy}
        aria-checked={checked}
        aria-disabled={isInert}
        aria-label={label}
        aria-selected={selected}
        className={className}
        disabled={isInert}
        hitSlop={hitSlop}
        role={role}
        onAccessibilityAction={onAccessibilityAction}
        onPress={handlePress}
        {...pressHandlers}
      >
        {/* The press overlay is a layer with no meaning of its own, so it has no role to query by. */}
        {isPressed && !isInert ? (
          <View className="absolute inset-0 bg-press-overlay" testID="press-overlay" />
        ) : null}
        {children}
      </Pressable>
    </Animated.View>
  );
}
