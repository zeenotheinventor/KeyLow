import { easingCurve, motionDuration } from "@keylow/tokens";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "../../../../../lib/motion";

import type { PillFillProps } from "./types";

const enterEasing = Easing.bezier(...easingCurve.enter);

// The design's reduce-motion block swaps every easing for `ease-out`, which is this curve, and keeps the transition.
const easeOutEasing = Easing.bezier(0, 0, 0.58, 1);

/**
 * The accent muted pill behind the selected icon on Android. It fades in and out over `--duration-quick`
 * on the enter curve, as the design's pill background transitions. With reduced motion it still fades,
 * because a fade moves nothing, and takes the ease-out curve the design gives it. It is always drawn,
 * clear when the destination is not selected, so one change fades one pill out and another in.
 */
export function PillFill({ isActive }: PillFillProps) {
  const isReducedMotion = useReducedMotion();
  const opacity = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    opacity.set(
      withTiming(isActive ? 1 : 0, {
        duration: motionDuration.quick,
        easing: isReducedMotion ? easeOutEasing : enterEasing,
      }),
    );
  }, [isActive, isReducedMotion, opacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  // A class and an animated style cannot share an element, so the fade sits on a wrapper with no class,
  // and the pill, which has a fixed size, is its child.
  return (
    <View className="absolute inset-0">
      <Animated.View style={fadeStyle} testID="tab-pill-fade">
        <View className="h-[28px] w-[56px] rounded-pill bg-accent-muted" />
      </Animated.View>
    </View>
  );
}
