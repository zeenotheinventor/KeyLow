import { easingCurve, motionDuration } from "@keylow/tokens";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import type { SlashSweepProps, SlashSweepVariant } from "./types";
import type { LayoutChangeEvent } from "react-native";

// The design's `kl-slash`: a slanted accent bar that starts 140 percent of its own width to the left, sweeps to 240 percent to the right, and fades from 0.9 to clear on the way.
const startShift = -1.4;
const endShift = 2.4;
const startOpacity = 0.9;
const leanDegrees = -22;

// The classes are written out so Tailwind sees them. The row's slash is 16 percent of the row wide and runs
// 20 percent past its top and bottom. The estimate card's is 45 percent of the card wide, runs 20 points
// past, and waits 120 ms, as its board draws it.
const variantLook: Record<SlashSweepVariant, { className: string; delay: number }> = {
  row: {
    className: "pointer-events-none absolute -bottom-[20%] -top-[20%] left-0 w-[16%]",
    delay: 0,
  },
  card: {
    className: "pointer-events-none absolute -bottom-[20px] -top-[20px] left-0 w-[45%]",
    delay: 120,
  },
};

/**
 * The accent slash that crosses the day complete row when the day becomes complete, or the estimate card
 * on arrival (`variant="card"`). It draws over its container and is hidden from screen readers. It sweeps
 * over `--duration-flourish` with `--ease-exit`, once, when it is mounted.
 */
export function SlashSweep({ variant = "row" }: SlashSweepProps) {
  const { className, delay } = variantLook[variant];
  const progress = useSharedValue(0);
  const width = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withDelay(
        delay,
        withTiming(1, {
          duration: motionDuration.flourish,
          easing: Easing.bezier(...easingCurve.exit),
        }),
      ),
    );
  }, [delay, progress]);

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

  // The slash runs past the top and bottom of what it crosses, which clips it. It has no role and no name,
  // so a test finds it by its test id.
  return (
    <View aria-hidden className={className}>
      <Animated.View aria-hidden style={sweepStyle} testID="day-complete-slash" onLayout={onLayout}>
        <View className="flex-1 bg-accent" />
      </Animated.View>
    </View>
  );
}
