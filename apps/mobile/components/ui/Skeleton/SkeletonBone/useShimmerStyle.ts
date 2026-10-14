import { useEffect } from "react";
import {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

// The design's `kl-shimmer`, 1400 ms and linear, which no token names.
const sweepDuration = 1400;
// The design's gradient is 40 percent of an image twice a bone's width, so a band 0.8 of a bone wide, and
// its peak travels from one bone width left of the bone to three right of it. The band sits at the left
// edge with its peak 0.4 in from it, so it shifts from 140 percent left to 260 percent right, and a
// percentage shift is a share of the width of the element that moves. The band is clear of the bone
// for more than half of each cycle, which is the idle time the design has.
const startShift = -140;
const endShift = 260;

/**
 * The shine sweeping across a bone, once every 1400 ms. Give
 * `animatedStyle` to an animated view that carries no class.
 */
export function useShimmerStyle() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(0);
    progress.set(withRepeat(withTiming(1, { duration: sweepDuration, easing: Easing.linear }), -1));

    return () => {
      cancelAnimation(progress);
    };
  }, [progress]);

  return useAnimatedStyle(() => ({
    transform: [{ translateX: `${startShift + (endShift - startShift) * progress.get()}%` }],
  }));
}
