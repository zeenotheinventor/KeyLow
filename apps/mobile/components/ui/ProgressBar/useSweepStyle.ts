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

import { useReducedMotion } from "../../../lib/motion";

const sweepDuration = 1200;
// The segment is two fifths of the track. A shift is a share of the segment's own width, so it starts one
// segment left of the track (-100) and ends at the track's right edge, which is 250 segment widths from
// the left edge of the track.
const segmentWidth = "40%";
const startShift = -100;
const endShift = 250;
// Reduced motion degrades the sweep to a fade: the segment fills the track, which dims and returns over
// the same time.
const dimmedOpacity = 0.4;

/**
 * The segment sweeping across an indeterminate bar, once every 1200 ms. With reduced motion nothing moves:
 * the segment fills the track and dims and returns. Give `animatedStyle` to an animated view that carries
 * no class, with the segment drawn inside it.
 */
export function useSweepStyle() {
  const isReducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(0);
    progress.set(
      isReducedMotion
        ? withRepeat(
            withSequence(
              withTiming(1, { duration: sweepDuration / 2 }),
              withTiming(0, { duration: sweepDuration / 2 }),
            ),
            -1,
          )
        : withRepeat(
            withTiming(1, { duration: sweepDuration, easing: Easing.inOut(Easing.ease) }),
            -1,
          ),
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [isReducedMotion, progress]);

  // The size is in the style, because a class cannot share an element with an animated style. Every property
  // is always set, so switching between the two paths leaves nothing stale behind.
  return useAnimatedStyle(() =>
    isReducedMotion
      ? {
          width: "100%",
          height: "100%",
          opacity: 1 - (1 - dimmedOpacity) * progress.get(),
          transform: [],
        }
      : {
          width: segmentWidth,
          height: "100%",
          opacity: 1,
          transform: [{ translateX: `${startShift + (endShift - startShift) * progress.get()}%` }],
        },
  );
}
