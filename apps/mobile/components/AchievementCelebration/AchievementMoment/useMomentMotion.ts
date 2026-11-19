import { motionDuration, springs } from "@keylow/tokens";
import { useEffect } from "react";
import {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "../../../lib/motion";

// Where the ring starts before it springs to its size.
const ringStartScale = 0.6;

/**
 * The ring scaling in on the spring ease, per board 3. With reduced motion the ring is drawn at its size at
 * once. Give the style to an animated view that carries no class.
 */
export function useRingStyle() {
  const isReducedMotion = useReducedMotion();
  const scale = useSharedValue(ringStartScale);

  useEffect(() => {
    scale.set(withSpring(1, springs.enter));
  }, [scale]);

  return useAnimatedStyle(() => ({
    opacity: isReducedMotion ? 1 : interpolate(scale.get(), [ringStartScale, 0.9], [0, 1], "clamp"),
    transform: [{ scale: isReducedMotion ? 1 : scale.get() }],
  }));
}

/**
 * A spark drifting out from the ring to its place over 400 ms (`--duration-flourish`), as board 3 says. With
 * reduced motion it is drawn in its place and moves nowhere. Give the style to an animated view that carries
 * no class.
 */
export function useSparkStyle(x: number, y: number) {
  const isReducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(1, { duration: motionDuration.flourish }));
  }, [progress]);

  return useAnimatedStyle(() => {
    const drift = isReducedMotion ? 1 : progress.get();
    return {
      opacity: drift,
      transform: [{ translateX: x * drift }, { translateY: y * drift }],
    };
  });
}
