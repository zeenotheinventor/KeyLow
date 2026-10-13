import { easingCurve, motionDuration } from "./source.generated";

// The design system readme maps each easing to its Reanimated call. The springs are written out
// there and nowhere in the tokens. The timings reuse the token curves and durations so they cannot
// drift from them.

/** `withSpring(value, springs.enter)`, the Reanimated equivalent of --ease-enter. */
export const springs = {
  enter: { damping: 18, stiffness: 260, mass: 0.9 },
  spring: { damping: 14, stiffness: 320, mass: 0.8 },
};

/** `withTiming(value, { duration, easing: Easing.bezier(...bezier) })`. */
export const timings = {
  whip: { duration: motionDuration.chart, bezier: easingCurve.whip },
  exit: { duration: motionDuration.standard, bezier: easingCurve.exit },
};
