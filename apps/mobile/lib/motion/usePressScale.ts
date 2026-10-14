import { motionDuration, pressScale, reducedMotion, springs } from "@keylow/tokens";
import { useState } from "react";
import { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { useReducedMotion } from "./useReducedMotion";

/**
 * The press feedback every pressable primitive shares: it compresses to `--press-scale` as the
 * finger lands, over `--duration-instant`, and springs back on release with `--ease-spring`'s
 * Reanimated mapping. With reduced motion the scale stays at 1, which is what the design's
 * reduce-motion block sets `--press-scale` to, so the press overlay is the only feedback.
 *
 * Spread `pressHandlers` on the `Pressable`, give `animatedStyle` to the surface that compresses and
 * draw the press overlay while `isPressed`.
 */
export function usePressScale() {
  const isReducedMotion = useReducedMotion();
  const [isPressed, setIsPressed] = useState(false);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const pressHandlers = {
    onPressIn: () => {
      setIsPressed(true);
      scale.set(
        withTiming(isReducedMotion ? reducedMotion.pressScale : pressScale, {
          duration: motionDuration.instant,
        }),
      );
    },
    onPressOut: () => {
      setIsPressed(false);
      scale.set(isReducedMotion ? withTiming(1) : withSpring(1, springs.spring));
    },
  };

  return { animatedStyle, isPressed, pressHandlers };
}
