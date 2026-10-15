import { easingCurve, motionDuration } from "@keylow/tokens";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { LayoutChangeEvent } from "react-native";

// The design's `kl-slash`: a slanted accent bar 16 percent of the row wide that starts 140 percent of its
// own width to the left, sweeps to 240 percent to the right, and fades from 0.9 to clear on the way.
const startShift = -1.4;
const endShift = 2.4;
const startOpacity = 0.9;
const leanDegrees = -22;

/**
 * The accent slash that crosses the day complete row when the day becomes complete. It draws over the
 * row and is hidden from screen readers. It sweeps over `--duration-flourish` with `--ease-exit`, once,
 * when it is mounted.
 */
export function SlashSweep() {
  const progress = useSharedValue(0);
  const width = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withTiming(1, {
        duration: motionDuration.flourish,
        easing: Easing.bezier(...easingCurve.exit),
      }),
    );
  }, [progress]);

  const onLayout = (event: LayoutChangeEvent) => {
    width.set(event.nativeEvent.layout.width);
  };

  const sweepStyle = useAnimatedStyle(() => ({
    flex: 1,
    // Until the row is measured the bar has no width to shift by and would sit on the left edge.
    opacity: width.get() === 0 ? 0 : interpolate(progress.get(), [0, 1], [startOpacity, 0]),
    transform: [
      { translateX: width.get() * interpolate(progress.get(), [0, 1], [startShift, endShift]) },
      { skewX: `${leanDegrees}deg` },
    ],
  }));

  // The slash runs past the row's top and bottom, which the row clips. It has no role and no name, so a
  // test finds it by its test id.
  return (
    <View
      aria-hidden
      className="pointer-events-none absolute -bottom-[20%] -top-[20%] left-0 w-[16%]"
    >
      <Animated.View aria-hidden style={sweepStyle} testID="day-complete-slash" onLayout={onLayout}>
        <View className="flex-1 bg-accent" />
      </Animated.View>
    </View>
  );
}
