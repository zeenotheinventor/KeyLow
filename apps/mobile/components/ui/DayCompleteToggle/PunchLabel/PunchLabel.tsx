import { easingCurve, motionDuration } from "@keylow/tokens";
import { useEffect } from "react";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { PunchLabelProps } from "./types";

// The design's `kl-punch`: the label starts 14 percent too big and clear, is full and 3 percent too
// small by 55 percent of the way, then settles to its size.
const startScale = 1.14;
const undershootScale = 0.97;
const undershootAt = 0.55;

/**
 * The words of the day complete row. When `isPunching` they punch in over `--duration-flourish` with
 * `--ease-enter`, and otherwise they are plain.
 */
export function PunchLabel({ children, isPunching }: PunchLabelProps) {
  const progress = useSharedValue(isPunching ? 0 : 1);

  useEffect(() => {
    // A label that stops punching, such as a day unmarked mid-punch, goes straight to its size.
    progress.set(
      isPunching
        ? withTiming(1, {
            duration: motionDuration.flourish,
            easing: Easing.bezier(...easingCurve.enter),
          })
        : 1,
    );
  }, [isPunching, progress]);

  const punchStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, undershootAt, 1], [0, 1, 1]),
    transform: [
      {
        scale: interpolate(progress.get(), [0, undershootAt, 1], [startScale, undershootScale, 1]),
      },
    ],
  }));

  // The wrapper has no role, so a test finds it by its test id.
  return (
    <Animated.View style={punchStyle} testID="day-complete-label">
      {children}
    </Animated.View>
  );
}
