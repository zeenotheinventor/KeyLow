import { easingCurve, motionDuration } from "@keylow/tokens";
import { useEffect } from "react";
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "../../../../lib/motion";

const enterEasing = Easing.bezier(...easingCurve.enter);

// The design's reduce-motion block swaps every easing for `ease-out`, which is this curve, so the fade
// has no overshoot.
const easeOutEasing = Easing.bezier(0, 0, 0.58, 1);

// `kl-punch`: the tick arrives 14% too large and clear, is at full opacity and 3% too small by 55% of
// the time, and settles at full size. Each leg takes the enter curve, as a keyframe animation does.
const startScale = 1.14;
const undershootScale = 0.97;
const undershootAt = 0.55;
const undershootDuration = motionDuration.quick * undershootAt;
const settleDuration = motionDuration.quick - undershootDuration;

/**
 * The tick's arrival (`kl-punch` at `--duration-quick` on `--ease-enter`). With reduced motion the
 * design sets the motion distance to 0, so the keyframe degrades to a fade: the tick stays at full size
 * and only the opacity arrives. Give `animatedStyle` to an animated view that carries no class, with the
 * tick drawn inside it.
 */
export function usePunchStyle() {
  const isReducedMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(isReducedMotion ? 1 : startScale);

  useEffect(() => {
    opacity.set(
      withTiming(1, {
        duration: undershootDuration,
        easing: isReducedMotion ? easeOutEasing : enterEasing,
      }),
    );
    if (isReducedMotion) {
      scale.set(1);
    } else {
      scale.set(startScale);
      scale.set(
        withSequence(
          withTiming(undershootScale, { duration: undershootDuration, easing: enterEasing }),
          withTiming(1, { duration: settleDuration, easing: enterEasing }),
        ),
      );
    }
  }, [isReducedMotion, opacity, scale]);

  return useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }));
}
