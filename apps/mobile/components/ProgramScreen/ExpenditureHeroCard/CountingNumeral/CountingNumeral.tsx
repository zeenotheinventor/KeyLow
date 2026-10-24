import { formatCalories } from "@keylow/core/format";
import { useEffect, useState } from "react";
import { Text as NativeText } from "react-native";
import Animated from "react-native-reanimated";

import { useAccentFlashStyle, useCountUp, useReducedMotion } from "../../../../lib/motion";
import { useTheme } from "../../../../lib/theme";

import type { CountingNumeralProps } from "./types";

/**
 * The hero's 40 point numeral. When a check-in has just arrived it counts up from the estimate before it and
 * flashes the accent, as the setup estimate's numeral does, once. With reduced motion it shows the estimate at
 * once and does not flash. Without an arrival it shows the estimate and nothing moves. The arrival is read when
 * the numeral is mounted, so a late answer never makes it jump back.
 */
export function CountingNumeral({ muKcal, arrival }: CountingNumeralProps) {
  const isReducedMotion = useReducedMotion();
  const [start] = useState(arrival);

  // The count starts from the old estimate and is told its target on the next frame, so it has somewhere to count from.
  const [hasArrived, setHasArrived] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setHasArrived(true);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);
  const isCounting = start !== null && !hasArrived && !isReducedMotion;
  const { value } = useCountUp(isCounting ? start.fromKcal : muKcal, isReducedMotion);
  const { colors } = useTheme();
  const flashStyle = useAccentFlashStyle(start !== null, colors["text-primary"], colors.accent);

  return (
    // The design sets the figure at 40 over 46, which is between the type scale's sizes, as the Trend weight card's is.
    <NativeText className="text-[40px] font-semibold leading-[46px] tracking-[-0.02em] tabular-nums text-text-primary">
      <Animated.Text style={flashStyle}>{formatCalories(value)}</Animated.Text>
    </NativeText>
  );
}
