import { motionDuration, pressScale, reducedMotion, springs } from "@keylow/tokens";
import { useCallback, useState } from "react";
import { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { useReducedMotion } from "./useReducedMotion";

/**
 * The press feedback every pressable primitive shares: it compresses to `--press-scale` as the
 * finger lands, over `--duration-instant`, and springs back on release with `--ease-spring`'s
 * Reanimated mapping. With reduced motion the scale stays at 1, which is what the design's
 * reduce-motion block sets `--press-scale` to, so the press overlay is the only feedback. `scale`
 * is for a surface the design presses by less than the token, such as a list row.
 *
 * Spread `pressHandlers` on the `Pressable`, give `animatedStyle` to the surface that compresses and
 * draw the press overlay while `isPressed`. `resetPress` lets go of a press that never got its
 * release, which is what happens when a pressable goes inert under the finger.
 */
export function usePressScale(scale = pressScale) {
  const isReducedMotion = useReducedMotion();
  const [isPressed, setIsPressed] = useState(false);
  const pressedScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressedScale.get() }] }));

  const resetPress = useCallback(() => {
    setIsPressed(false);
    pressedScale.set(isReducedMotion ? withTiming(1) : withSpring(1, springs.spring));
  }, [isReducedMotion, pressedScale]);

  const pressHandlers = {
    onPressIn: () => {
      setIsPressed(true);
      pressedScale.set(
        withTiming(isReducedMotion ? reducedMotion.pressScale : scale, {
          duration: motionDuration.instant,
        }),
      );
    },
    onPressOut: resetPress,
  };

  return { animatedStyle, isPressed, pressHandlers, resetPress };
}
