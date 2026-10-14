import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "../../../../lib/motion";

import type { ButtonVariant } from "../types";
import type { ButtonSpinnerProps } from "./types";

// The design's ring: 18 points, a 2 point border, the right side open, turning once every 700 ms
// (`kl-spin`). The ring takes the label's colour, so each variant names the border that matches it.
const ringClassName = "h-[18px] w-[18px] rounded-pill border-2 border-r-transparent";

// A class and an animated style cannot share an element: NativeWind merges the two and loses the
// classes. So the animated element carries no class, and the ring it turns is its child.

const borderClassName: Record<ButtonVariant, string> = {
  primary: "border-accent-foreground",
  secondary: "border-text-primary",
  destructive: "border-text-on-status",
  ghost: "border-text-primary",
};

const turnDuration = 700;
// Reduced motion degrades the turn to a fade: the ring dims and returns over the same 700 ms.
const dimmedOpacity = 0.4;

export function ButtonSpinner({ variant }: ButtonSpinnerProps) {
  const isReducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(0);
    progress.set(
      isReducedMotion
        ? withRepeat(
            withSequence(
              withTiming(1, { duration: turnDuration / 2 }),
              withTiming(0, { duration: turnDuration / 2 }),
            ),
            -1,
          )
        : withRepeat(withTiming(1, { duration: turnDuration, easing: Easing.linear }), -1),
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [isReducedMotion, progress]);

  // Both properties are always set, so switching between the two paths leaves nothing stale behind.
  const animatedStyle = useAnimatedStyle(() =>
    isReducedMotion
      ? { opacity: 1 - (1 - dimmedOpacity) * progress.get(), transform: [{ rotate: "0deg" }] }
      : { opacity: 1, transform: [{ rotate: `${progress.get() * 360}deg` }] },
  );

  return (
    <View className="absolute inset-0 items-center justify-center">
      <Animated.View accessible aria-label="Loading" role="progressbar" style={animatedStyle}>
        <View className={`${ringClassName} ${borderClassName[variant]}`} />
      </Animated.View>
    </View>
  );
}
