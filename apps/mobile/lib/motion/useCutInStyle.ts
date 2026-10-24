import { easingCurve, motionDuration, motionScale } from "@keylow/tokens";
import { useEffect } from "react";
import {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "./useReducedMotion";

// The design's `kl-cut-in`, keyframe by keyframe. The surface starts 28 points to the right, leaning back 8
// degrees and clear. At 65 percent it is fully drawn, 3 points past its place and leaning forward 2
// degrees, and it settles on its place, upright, at the end. Each leg has its own `--ease-enter`, as a
// CSS animation gives each interval between keyframes.
const startShift = 28 * motionScale.distance;
const overshootShift = -3 * motionScale.distance;
const startLeanDegrees = -8 * motionScale.skew;
const overshootLeanDegrees = 2 * motionScale.skew;
const overshootAt = 0.65;
const firstLegDuration = motionDuration.standard * overshootAt;
const secondLegDuration = motionDuration.standard * (1 - overshootAt);

/**
 * The cut-in of a surface from the side over `--duration-standard`, once, when it is mounted with `isActive`.
 * A surface that is not active is drawn at once, in its place. With reduced motion it only fades, and moves
 * nothing. Give the style to an animated view that carries no class.
 */
export function useCutInStyle(isActive: boolean, delay = 0) {
  const isReducedMotion = useReducedMotion();
  const fade = useSharedValue(isActive ? 0 : 1);
  const firstLeg = useSharedValue(0);
  const secondLeg = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      fade.set(withTiming(1, { duration: motionDuration.quick }));
    }
  }, [fade, isActive]);

  useEffect(() => {
    if (isActive) {
      const easing = Easing.bezier(...easingCurve.enter);
      firstLeg.set(withDelay(delay, withTiming(1, { duration: firstLegDuration, easing })));
      secondLeg.set(
        withDelay(delay + firstLegDuration, withTiming(1, { duration: secondLegDuration, easing })),
      );
    }
  }, [delay, firstLeg, isActive, secondLeg]);

  // One animated style serves every path, because a style that is swapped for another leaves what it set
  // behind. Reduced motion says "no transform" outright, so a cut-in that began before the setting was read
  // does not leave the surface shifted.
  return useAnimatedStyle(() => {
    if (!isActive || isReducedMotion) {
      return { opacity: fade.get(), transform: [] };
    }
    const isSettling = secondLeg.get() > 0;
    return {
      opacity: isSettling ? 1 : interpolate(firstLeg.get(), [0, 1], [0, 1], "clamp"),
      transform: [
        {
          translateX: isSettling
            ? interpolate(secondLeg.get(), [0, 1], [overshootShift, 0])
            : interpolate(firstLeg.get(), [0, 1], [startShift, overshootShift]),
        },
        {
          skewX: `${
            isSettling
              ? interpolate(secondLeg.get(), [0, 1], [overshootLeanDegrees, 0])
              : interpolate(firstLeg.get(), [0, 1], [startLeanDegrees, overshootLeanDegrees])
          }deg`,
        },
      ],
    };
  });
}
