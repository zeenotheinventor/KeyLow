import {
  CALORIE_RING,
  describeCalorieRing,
  describeEatenLine,
  describeTargetLine,
} from "@keylow/core/copy";
import { compactBelowSize, ringNumbers } from "@keylow/core/diary";
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
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { outlineWidth, ringPaths } from "./ringMaths";
import { useCountUp } from "./useCountUp";
import { useReducedMotion, useWhipFill } from "../../../lib/motion";
import { strokePaint } from "../../../lib/skia/strokePaint";
import { StyledCanvas } from "../../../lib/skia/StyledCanvas";
import { outlineColour, useTheme } from "../../../lib/theme";
import { Text } from "../Text";

import type { CalorieRingProps } from "./types";

const flashEasing = Easing.bezier(...easingCurve.exit);

function captionOf({
  hasTarget,
  isOver,
  label,
}: {
  hasTarget: boolean;
  isOver: boolean;
  label: string;
}): string {
  if (!hasTarget) {
    return CALORIE_RING.eaten;
  }

  return isOver ? CALORIE_RING.overTarget : label;
}

/**
 * The calories left as a display numeral inside a ring that fills eaten over target. Over target the
 * ring is full and gains two outlines of its own colour mixed with white, a 1 point gap outside the
 * stroke and the same inside it (ruling 17): no warning colour, and the numeral stays in the primary
 * ink. A target of zero means none is set: the ring is empty and the numeral is the calories eaten. The
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
  const { eatenFraction, remainingCalories, hasTarget, isOver } = ringNumbers(eaten, target);
  const isCompact = size < compactBelowSize;
  const paths = ringPaths(size, stroke);
  const outline = outlineColour(colors.calories);

  const eatenFilled = useWhipFill(eatenFraction);

  const { value, arrivals } = useCountUp(remainingCalories, isReducedMotion);
  const flash = useSharedValue(0);
  useEffect(() => {
    if (arrivals > 0 && !isReducedMotion) {
      flash.set(1);
      flash.set(withTiming(0, { duration: motionDuration.flourish, easing: flashEasing }));
    }
  }, [arrivals, flash, isReducedMotion]);

  const restingColor = colors["text-primary"];
  const accent = colors.accent;
  const flashStyle = useAnimatedStyle(() => ({
    color: interpolateColor(flash.get(), [0, 1], [restingColor, accent]),
  }));

  return (
    <View
      accessible
      aria-label={describeCalorieRing(eaten, target)}
      role="img"
      style={vars({ "--ring-size": `${size}px` })}
    >
      <View className="h-[var(--ring-size)] w-[var(--ring-size)]">
        {/* The canvas is larger than the ring, so the outer outline is not clipped, and sits over it, so the layout does not move. */}
        <StyledCanvas className="absolute -inset-[3px]">
          <Path
            color={colors.border}
            end={1}
            path={paths.ring}
            start={0}
            strokeWidth={stroke}
            {...strokePaint}
          />
          {eatenFraction > 0 && (
            <Path
              color={colors.calories}
              end={eatenFilled}
              path={paths.ring}
              start={0}
              strokeCap="round"
              strokeWidth={stroke}
              {...strokePaint}
            />
          )}
          {isOver && (
            <Path
              color={outline}
              end={1}
              path={paths.outerOutline}
              start={0}
              strokeWidth={outlineWidth}
              {...strokePaint}
            />
          )}
          {isOver && (
            <Path
              color={outline}
              end={1}
              path={paths.innerOutline}
              start={0}
              strokeWidth={outlineWidth}
              {...strokePaint}
            />
          )}
        </StyledCanvas>
        <View className="absolute inset-[28px] items-center justify-center gap-[2px]">
          <Text variant={isCompact ? "h1" : "ring-numeral"}>
            <Animated.Text style={flashStyle}>{formatCalories(value)}</Animated.Text>
          </Text>
          <Text tone="secondary" variant="caption">
            {captionOf({ hasTarget, isOver, label })}
          </Text>
          {!isCompact && hasTarget && (
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
