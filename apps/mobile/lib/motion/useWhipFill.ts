import { timings } from "@keylow/tokens";
import { useEffect } from "react";
import { Easing, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { useReducedMotion } from "./useReducedMotion";

const whip = Easing.bezier(...timings.whip.bezier);

/**
 * How far a ring or a bar is drawn, from 0 to 1. It starts empty and whips in to `fraction` with
 * `--ease-whip` over `--duration-chart`, after `delay` milliseconds when given one (a bar's place in the
 * stagger), and whips again when `fraction` changes. With reduced motion it is drawn at once.
 */
export function useWhipFill(fraction: number, delay = 0) {
  const isReducedMotion = useReducedMotion();
  const filled = useSharedValue(0);

  useEffect(() => {
    filled.set(
      isReducedMotion
        ? fraction
        : withDelay(delay, withTiming(fraction, { duration: timings.whip.duration, easing: whip })),
    );
  }, [delay, filled, fraction, isReducedMotion]);

  return filled;
}
