import { easingCurve, motionDuration } from "@keylow/tokens";
import { useEffect } from "react";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useFadeInStyle, useReducedMotion } from "../../../../lib/motion";
import { Text } from "../../Text";

import type { WipeInLabelProps } from "./types";

// The design's `kl-wipe-in` reveals the label with an angled clip. A native view has no clip path, so
// the label cuts in instead: it slides in from the side, skewed, and straightens as it settles, over
// the same `--duration-standard` and `--ease-whip`. These are how far it slides and how far it leans.
const slideDistance = 24;
const leanDegrees = 12;

// The label is on screen from the first frame of the keyframes' 1 percent mark.
const visibleAfter = 0.01;

/**
 * A day's label that cuts in when it first shows. Give it a key of the label, so a new day mounts a
 * new one and the cut-in plays again. A step back cuts in from the other side. With reduced motion it
 * only fades, which moves nothing.
 */
export function WipeInLabel({ children, isStepBack }: WipeInLabelProps) {
  const isReducedMotion = useReducedMotion();
  const fadeStyle = useFadeInStyle();
  const progress = useSharedValue(0);
  const side = isStepBack ? 1 : -1;

  useEffect(() => {
    progress.set(
      withTiming(1, {
        duration: motionDuration.standard,
        easing: Easing.bezier(...easingCurve.whip),
      }),
    );
  }, [progress]);

  const wipeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, visibleAfter, 1], [0, 1, 1]),
    transform: [
      { translateX: side * slideDistance * (1 - progress.get()) },
      { skewX: `${-side * leanDegrees * (1 - progress.get())}deg` },
    ],
  }));

  const animatedStyle = isReducedMotion ? fadeStyle : wipeStyle;

  // A class and an animated style cannot share an element, so the cut-in sits on a wrapper of its own.
  // It has no role, so a test finds it by its test id.
  return (
    <Animated.View style={animatedStyle} testID="day-stepper-label">
      <Text variant="h2">{children}</Text>
    </Animated.View>
  );
}
