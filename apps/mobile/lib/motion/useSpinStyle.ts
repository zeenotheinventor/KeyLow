import { useEffect } from "react";
import {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "./useReducedMotion";

const turnDuration = 700;
// Reduced motion degrades the turn to a fade: the ring dims and returns over the same 700 ms.
const dimmedOpacity = 0.4;

/**
 * The spin every spinner shares (`kl-spin`): a full turn every 700 ms. With reduced motion it does not
 * turn: it dims and returns over the same time. Give `animatedStyle` to an animated view that carries
 * no class, with the spinner drawn inside it.
 */
export function useSpinStyle() {
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
  return useAnimatedStyle(() =>
    isReducedMotion
      ? { opacity: 1 - (1 - dimmedOpacity) * progress.get(), transform: [{ rotate: "0deg" }] }
      : { opacity: 1, transform: [{ rotate: `${progress.get() * 360}deg` }] },
  );
}
