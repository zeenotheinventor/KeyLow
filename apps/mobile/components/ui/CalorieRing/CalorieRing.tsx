import {
  CALORIE_RING,
  describeCalorieRing,
  describeEatenLine,
  describeTargetLine,
} from "@keylow/core/copy";
import { formatCalories } from "@keylow/core/format";
import { easingCurve, motionDuration } from "@keylow/tokens";
import { Path } from "@shopify/react-native-skia";
import { vars } from "nativewind";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { ringCircumference, ringNumbers, ringPath, compactBelowSize } from "./ringMaths";
import { useCountUp } from "./useCountUp";
import { useReducedMotion, useWhipFill } from "../../../lib/motion";
import { strokePaint } from "../../../lib/skia/strokePaint";
import { StyledCanvas } from "../../../lib/skia/StyledCanvas";
import { useTheme } from "../../../lib/theme";
import { Text } from "../Text";

import type { CalorieRingProps } from "./types";

const flashEasing = Easing.bezier(...easingCurve.exit);

/**
 * The diary's hero: the calories left as a display numeral inside a ring that fills eaten over target.
 * Past the target the ring keeps filling in warning on top, and never resets or turns to danger. The
 * numeral counts to a new value and flashes the accent as it lands. It is one image to a screen reader.
 */
export function CalorieRing({
  eaten,
  target,
  size = 200,
  stroke = 14,
  label = CALORIE_RING.remaining,
  estimate = true,
}: CalorieRingProps) {
  const { colors } = useTheme();
  const isReducedMotion = useReducedMotion();
  const { eatenFraction, overFraction, remainingCalories, isOver } = ringNumbers(eaten, target);
  const isCompact = size < compactBelowSize;
  const path = ringPath(size, stroke);

  const eatenFilled = useWhipFill(eatenFraction);
  const overFilled = useWhipFill(overFraction);
  // The notch is a gap of 2 points, 1 each side of where the warning ends.
  const notchHalf = 1 / ringCircumference(size, stroke);
  const notchStart = useDerivedValue(() => Math.max(0, overFilled.get() - notchHalf));
  const notchEnd = useDerivedValue(() => Math.min(1, overFilled.get() + notchHalf));

  const { value, arrivals } = useCountUp(remainingCalories, isReducedMotion);
  const flash = useSharedValue(0);
  useEffect(() => {
    if (arrivals > 0 && !isReducedMotion) {
      flash.set(1);
      flash.set(withTiming(0, { duration: motionDuration.flourish, easing: flashEasing }));
    }
  }, [arrivals, flash, isReducedMotion]);

  const restingColor = isOver ? colors["warning-ink"] : colors["text-primary"];
  const accent = colors.accent;
  const flashStyle = useAnimatedStyle(() => ({
    color: interpolateColor(flash.get(), [0, 1], [restingColor, accent]),
  }));

  const tone = isOver ? "warning-ink" : "primary";

  return (
    <View
      accessible
      aria-label={describeCalorieRing(eaten, target)}
      role="img"
      style={vars({ "--ring-size": `${size}px` })}
    >
      <View className="h-[var(--ring-size)] w-[var(--ring-size)]">
        <StyledCanvas className="h-full w-full">
          <Path
            color={colors.border}
            end={1}
            path={path}
            start={0}
            strokeWidth={stroke}
            {...strokePaint}
          />
          {eatenFraction > 0 && (
            <Path
              color={colors.calories}
              end={eatenFilled}
              path={path}
              start={0}
              strokeCap="round"
              strokeWidth={stroke}
              {...strokePaint}
            />
          )}
          {overFraction > 0 && (
            <Path
              color={colors.warning}
              end={overFilled}
              path={path}
              start={0}
              strokeCap="round"
              strokeWidth={stroke}
              {...strokePaint}
            />
          )}
          {overFraction > 0 && (
            <Path
              color={colors.background}
              end={notchEnd}
              path={path}
              start={notchStart}
              strokeWidth={stroke + 4}
              {...strokePaint}
            />
          )}
        </StyledCanvas>
        <View className="absolute inset-[28px] items-center justify-center gap-[2px]">
          <Text tone={tone} variant={isCompact ? "h1" : "ring-numeral"}>
            <Animated.Text style={flashStyle}>{formatCalories(value)}</Animated.Text>
          </Text>
          <Text tone={isOver ? "warning-ink" : "secondary"} variant="caption">
            {isOver ? CALORIE_RING.overTarget : label}
          </Text>
          {!isCompact && (
            <View className="mt-[2px] items-center">
              <Text tone="muted" variant="caption">
                {describeEatenLine(eaten)}
              </Text>
              <Text tone="muted" variant="caption">
                {describeTargetLine(target, estimate)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
