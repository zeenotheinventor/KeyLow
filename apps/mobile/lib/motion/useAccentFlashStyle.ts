import { easingCurve, motionDuration } from "@keylow/tokens";
import { useEffect } from "react";
import {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "./useReducedMotion";

// The design's `kl-flash`: the numeral is the accent from the first frame, and 200 ms in, while it is
// still counting, it returns to its own colour over `--duration-chart` with `--ease-whip`.
const flashEasing = Easing.bezier(...easingCurve.whip);
const flashDelay = 200;

/**
 * The colour of a numeral that flashes the accent once, when `isActive`, and is its own colour otherwise and
 * with reduced motion. The caller gives the two colours, from the theme. Give the style to an animated text that
 * carries no class.
 */
export function useAccentFlashStyle(isActive: boolean, restingColor: string, accentColor: string) {
  const isReducedMotion = useReducedMotion();
  const isFlashing = isActive && !isReducedMotion;
  const flash = useSharedValue(isFlashing ? 1 : 0);

  useEffect(() => {
    if (isFlashing) {
      flash.set(
        withDelay(
          flashDelay,
          withTiming(0, { duration: motionDuration.chart, easing: flashEasing }),
        ),
      );
    } else {
      flash.set(0);
    }
  }, [flash, isFlashing]);

  return useAnimatedStyle(() => ({
    color: interpolateColor(flash.get(), [0, 1], [restingColor, accentColor]),
  }));
}
